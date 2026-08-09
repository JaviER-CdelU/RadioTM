#!/usr/bin/env python3
"""Actualiza assets/data/rio.json desde el Instituto Nacional del Agua (INA).

- Reintenta la consulta hasta 3 veces.
- Lee la tabla de niveles hidrométricos del reporte diario oficial del INA
  (Alerta Hidrológico Cuenca del Plata), estación "Concepción del Uruguay".
- Si el INA no responde o cambia el formato, conserva el último JSON y
  finaliza sin romper el workflow.

Nota: la fuente anterior (Prefectura Naval Argentina) bloquea el acceso
automático (403 / robots.txt), por eso se migró al INA, que sí es accesible
por scripts y publica el mismo tipo de dato (altura del río, en metros,
con niveles de alerta y evacuación) actualizado a diario.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request

SOURCE_URL = "https://alerta.ina.gob.ar/a5/diario/reporte_diario"
STATION_NAME = "Concepci\u00f3n del Uruguay"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "rio.json"
DEFAULT_ALERT = 5.30
DEFAULT_EVACUATION = 6.30


def load_previous() -> dict[str, object]:
    if not OUTPUT.exists():
        return {}
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    except Exception:
        return {}


def fetch_html() -> str | None:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={
            "User-Agent": "Mozilla/5.0 RadioTiempoMuerto/2.0 (+https://javier-cdelu.github.io/RadioTM/)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "es-AR,es;q=0.9",
        },
    )

    for attempt in range(1, 4):
        try:
            print(f"Consulta al INA: intento {attempt}/3")
            with urllib.request.urlopen(request, timeout=60) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, errors="replace")
        except (TimeoutError, urllib.error.URLError, OSError) as exc:
            print(f"ADVERTENCIA: intento {attempt} falló: {exc}", file=sys.stderr)
            if attempt < 3:
                time.sleep(10 * attempt)

    return None


def parse_number(value: str) -> float:
    return float(value.replace(",", "."))


def parse_data(html: str, previous_data: dict[str, object]) -> dict[str, object]:
    # Ubica la fila de la estación dentro de la tabla de niveles del INA.
    idx = html.find(STATION_NAME)
    if idx == -1:
        # Por si el HTML llega sin tilde o con entidad HTML.
        idx = html.find("Concepcion del Uruguay")
    if idx == -1:
        raise RuntimeError("No se encontró la estación 'Concepción del Uruguay' en el reporte del INA.")

    window = html[idx: idx + 2500]

    level_match = re.search(
        r'title="fecha:\s*(\d{2}/\d{2}/\d{4})\s+(\d{2}:\d{2})\s+([0-9]+(?:[.,][0-9]+)?)\s*m"',
        window,
    )
    if not level_match:
        raise RuntimeError("No se pudo leer la altura actual en la fila de Concepción del Uruguay.")

    fecha, hora, current_raw = level_match.groups()
    current_value = parse_number(current_raw)
    official_updated = f"{fecha} {hora}"

    variation_match = re.search(
        r'title="diferencia con el registro anterior:\s*(-?[0-9]+(?:[.,][0-9]+)?)\s*m"',
        window,
    )
    variation = round(parse_number(variation_match.group(1)), 2) if variation_match else 0.0
    previous_value = round(current_value - variation, 2)

    # Alerta y evacuación: primeros dos números "sueltos" en celdas de tabla
    # que siguen a la celda de nivel (no envueltos en un link con title).
    # Se arranca a buscar recién después del cierre de la celda de nivel
    # (</td>), para no confundir el propio valor del nivel con el umbral.
    cell_close = window.find("</td>", level_match.end())
    after_level = window[cell_close:] if cell_close != -1 else window[level_match.end():]
    thresholds = re.findall(r'>\s*([0-9]+(?:[.,][0-9]+)?)\s*<', after_level)
    if len(thresholds) >= 2:
        alert = parse_number(thresholds[0])
        evacuation = parse_number(thresholds[1])
    else:
        alert = float(previous_data.get("alert", DEFAULT_ALERT) or DEFAULT_ALERT)
        evacuation = float(previous_data.get("evacuation", DEFAULT_EVACUATION) or DEFAULT_EVACUATION)

    if variation > 0.005:
        trend = "CRECE"
    elif variation < -0.005:
        trend = "BAJA"
    else:
        trend = "ESTABLE"

    return {
        "port": "Concepción del Uruguay",
        "river": "Uruguay",
        "current": current_value,
        "previous": previous_value,
        "variation": variation,
        "trend": trend,
        "official_updated": official_updated,
        "previous_updated": None,
        "alert": alert,
        "evacuation": evacuation,
        "source_url": SOURCE_URL,
        "source": "Instituto Nacional del Agua (INA)",
        "status": "ok",
    }


def preserve_previous(previous_data: dict[str, object], message: str) -> int:
    if previous_data:
        print(f"ADVERTENCIA: {message}")
        print("Se conserva el último dato válido publicado. El workflow no se marca como fallido.")
        return 0
    print(f"ERROR: {message}", file=sys.stderr)
    print("No existe un dato anterior para conservar.", file=sys.stderr)
    return 1


def main() -> int:
    previous_data = load_previous()
    html = fetch_html()
    if not html:
        return preserve_previous(previous_data, "El INA no respondió después de 3 intentos.")

    try:
        data = parse_data(html, previous_data)
    except Exception as exc:
        return preserve_previous(previous_data, f"No se pudo interpretar el reporte del INA: {exc}")

    same_record = (
        previous_data.get("current") == data.get("current")
        and previous_data.get("official_updated") == data.get("official_updated")
    )
    data["checked_at"] = (
        previous_data.get("checked_at")
        if same_record and previous_data.get("checked_at")
        else dt.datetime.now(dt.timezone.utc).isoformat()
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Río Uruguay: {data['current']} m, {data['trend']}, "
        f"registro oficial {data['official_updated']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
