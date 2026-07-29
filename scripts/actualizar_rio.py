#!/usr/bin/env python3
"""Actualiza assets/data/rio.json desde Prefectura Naval Argentina.

No requiere paquetes externos. Si la fuente falla o cambia de formato, termina
con error y conserva el último JSON válido que ya está publicado.
"""
from __future__ import annotations

import datetime as dt
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import urllib.request

SOURCE_URL = "https://contenidosweb.prefecturanaval.gob.ar/alturas/?id=720&page=historico&tiempo=7"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "rio.json"


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        value = " ".join(data.split())
        if value:
            self.parts.append(value)


def fetch_text() -> str:
    request = urllib.request.Request(
        SOURCE_URL,
        headers={
            "User-Agent": "RadioTiempoMuerto/1.0 (+https://javier-cdelu.github.io/RadioTM/)"
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        raw = response.read().decode(charset, errors="replace")
    parser = TextExtractor()
    parser.feed(raw)
    return html.unescape(" ".join(parser.parts))


def parse_number(value: str) -> float:
    return float(value.replace(",", "."))


def extract(pattern: str, text: str, label: str) -> re.Match[str]:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        raise RuntimeError(f"No se pudo encontrar {label} en la página de Prefectura.")
    return match


def parse_data(text: str) -> dict[str, object]:
    latest = extract(
        r"[ÚU]ltimo registro:\s*([0-9]+(?:[.,][0-9]+)?)\s*Mts\s*el\s*(.+?)\s*Registro anterior:",
        text,
        "el último registro",
    )
    previous = extract(
        r"Registro anterior:\s*([0-9]+(?:[.,][0-9]+)?)\s*Mts\s*el\s*(.+?)\s*Alerta:",
        text,
        "el registro anterior",
    )
    alert = extract(r"Alerta:\s*([0-9]+(?:[.,][0-9]+)?)\s*Mts", text, "el nivel de alerta")
    evacuation = extract(r"Evacuaci[oó]n:\s*([0-9]+(?:[.,][0-9]+)?)\s*Mts", text, "el nivel de evacuación")

    current_value = parse_number(latest.group(1))
    previous_value = parse_number(previous.group(1))
    variation = round(current_value - previous_value, 2)
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
        "official_updated": latest.group(2).strip(),
        "previous_updated": previous.group(2).strip(),
        "alert": parse_number(alert.group(1)),
        "evacuation": parse_number(evacuation.group(1)),
        "source_url": SOURCE_URL,
        "source": "Prefectura Naval Argentina",
        "status": "ok",
    }


def main() -> int:
    text = fetch_text()
    data = parse_data(text)

    previous_data: dict[str, object] = {}
    if OUTPUT.exists():
        try:
            previous_data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except Exception:
            previous_data = {}

    # Solo cambia checked_at cuando Prefectura publicó un nuevo registro. Así se
    # evitan decenas de commits diarios si la cifra oficial sigue igual.
    same_record = (
        previous_data.get("current") == data.get("current")
        and previous_data.get("official_updated") == data.get("official_updated")
    )
    if same_record and previous_data.get("checked_at"):
        data["checked_at"] = previous_data["checked_at"]
    else:
        data["checked_at"] = dt.datetime.now(dt.timezone.utc).isoformat()

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Río Uruguay: {data['current']} m, {data['trend']}, "
        f"registro {data['official_updated']}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
