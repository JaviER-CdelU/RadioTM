#!/usr/bin/env python3
"""Actualiza assets/data/rio.json desde Prefectura Naval Argentina.

- Reintenta la consulta hasta 3 veces.
- Usa un tiempo de espera mayor.
- Lee la tabla de últimos registros del sitio oficial.
- Si Prefectura no responde, conserva el último JSON y finaliza sin romper el workflow.
"""
from __future__ import annotations

import datetime as dt
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request

SOURCE_URL = "https://contenidosweb.prefecturanaval.gob.ar/alturas/?id=720&page=historico&tiempo=7"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "rio.json"
DEFAULT_ALERT = 5.30
DEFAULT_EVACUATION = 6.30


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        value = " ".join(data.split())
        if value:
            self.parts.append(value)


def load_previous() -> dict[str, object]:
    if not OUTPUT.exists():
        return {}
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    except Exception:
        return {}


def fetch_text() -> str | None:
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
            print(f"Consulta a Prefectura: intento {attempt}/3")
            with urllib.request.urlopen(request, timeout=90) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                raw = response.read().decode(charset, errors="replace")
            parser = TextExtractor()
            parser.feed(raw)
            return " ".join(parser.parts)
        except (TimeoutError, urllib.error.URLError, OSError) as exc:
            print(f"ADVERTENCIA: intento {attempt} falló: {exc}", file=sys.stderr)
            if attempt < 3:
                time.sleep(10 * attempt)

    return None


def parse_number(value: str) -> float:
    return float(value.replace(",", "."))


def parse_data(text: str, previous_data: dict[str, object]) -> dict[str, object]:
    # La página oficial muestra filas con: YYYY-MM-DD HH:MM | 4.57 Mts
    rows = re.findall(
        r"(20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+([0-9]+(?:[.,][0-9]+)?)\s*Mts",
        text,
        flags=re.IGNORECASE,
    )
    if len(rows) < 2:
        raise RuntimeError("No se encontraron al menos dos registros en la tabla oficial de Prefectura.")

    latest_date, latest_value_raw = rows[0]
    previous_date, previous_value_raw = rows[1]
    current_value = parse_number(latest_value_raw)
    previous_value = parse_number(previous_value_raw)
    variation = round(current_value - previous_value, 2)

    if variation > 0.005:
        trend = "CRECE"
    elif variation < -0.005:
        trend = "BAJA"
    else:
        trend = "ESTABLE"

    alert = float(previous_data.get("alert", DEFAULT_ALERT) or DEFAULT_ALERT)
    evacuation = float(previous_data.get("evacuation", DEFAULT_EVACUATION) or DEFAULT_EVACUATION)

    return {
        "port": "Concepción del Uruguay",
        "river": "Uruguay",
        "current": current_value,
        "previous": previous_value,
        "variation": variation,
        "trend": trend,
        "official_updated": latest_date,
        "previous_updated": previous_date,
        "alert": alert,
        "evacuation": evacuation,
        "source_url": SOURCE_URL,
        "source": "Prefectura Naval Argentina",
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
    text = fetch_text()
    if not text:
        return preserve_previous(previous_data, "Prefectura no respondió después de 3 intentos.")

    try:
        data = parse_data(text, previous_data)
    except Exception as exc:
        return preserve_previous(previous_data, f"No se pudo interpretar la página oficial: {exc}")

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
