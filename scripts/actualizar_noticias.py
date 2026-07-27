#!/usr/bin/env python3
"""Actualiza assets/data/noticias.json.

Lee las fuentes activas de Firestore (colección `fuentes`) y usa Google News RSS
para encontrar publicaciones del dominio de cada medio. Facebook e Instagram se
omiten porque requieren una integración oficial de Meta. No copia artículos:
guarda título, resumen breve, fecha, fuente y enlace de lectura.
"""
from __future__ import annotations

import datetime as dt
import email.utils
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

PROJECT_ID = "radio-tiempo-muerto-662a1"
FIREBASE_API_KEY = "AIzaSyC58rAZNDk0IwsP_17Zyuat_RNirVy88So"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents:runQuery?key={FIREBASE_API_KEY}"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "noticias.json"
USER_AGENT = "RadioTiempoMuerto/1.0 (+https://javier-cdelu.github.io/RadioTM/)"

FALLBACK_SOURCES = [
    {"id":"la-piramide","nombre":"La Pirámide","url":"https://www.lapiramide.net/","tipo":"Web","zona":"Local","cantidad":2,"activa":True},
    {"id":"diario-la-calle","nombre":"Diario La Calle","url":"https://lacalle.com.ar/","tipo":"Web","zona":"Local","cantidad":2,"activa":True},
    {"id":"el-miercoles-digital","nombre":"El Miércoles Digital","url":"https://www.elmiercolesdigital.com.ar/","tipo":"Web","zona":"Local","cantidad":2,"activa":True},
    {"id":"r2820","nombre":"R2820","url":"https://www.r2820.com/","tipo":"Web","zona":"Regional","cantidad":2,"activa":True},
    {"id":"el-entre-rios","nombre":"El Entre Ríos","url":"https://www.elentrerios.com/","tipo":"Web","zona":"Regional","cantidad":2,"activa":True},
    {"id":"elonce","nombre":"Elonce","url":"https://www.elonce.com/","tipo":"Web","zona":"Provincial","cantidad":2,"activa":True},
    {"id":"pagina-12","nombre":"Página/12","url":"https://www.pagina12.com.ar/","tipo":"Web","zona":"Nacional","cantidad":2,"activa":True},
    {"id":"clarin","nombre":"Clarín","url":"https://www.clarin.com/","tipo":"Web","zona":"Nacional","cantidad":2,"activa":True},
    {"id":"ole","nombre":"Olé","url":"https://www.ole.com.ar/","tipo":"Web","zona":"Deportes","cantidad":2,"activa":True},
]

class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(); self.parts: list[str] = []
    def handle_data(self, data: str) -> None:
        value = " ".join(data.split())
        if value: self.parts.append(value)

def clean_html(value: str) -> str:
    parser = TextExtractor(); parser.feed(html.unescape(value or ""))
    text = " ".join(parser.parts)
    return re.sub(r"\s+", " ", text).strip()

def request_bytes(url: str, *, data: bytes | None = None, content_type: str | None = None) -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"}
    if content_type: headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=35) as response:
        return response.read()

def firestore_value(value: dict) -> object:
    if "stringValue" in value: return value["stringValue"]
    if "booleanValue" in value: return value["booleanValue"]
    if "integerValue" in value: return int(value["integerValue"])
    if "doubleValue" in value: return float(value["doubleValue"])
    if "timestampValue" in value: return value["timestampValue"]
    return None

def load_active_sources() -> list[dict]:
    body = {
        "structuredQuery": {
            "from": [{"collectionId": "fuentes"}],
            "where": {"fieldFilter": {"field": {"fieldPath": "activa"}, "op": "EQUAL", "value": {"booleanValue": True}}}
        }
    }
    try:
        raw = request_bytes(FIRESTORE_URL, data=json.dumps(body).encode(), content_type="application/json")
        rows = json.loads(raw)
        sources: list[dict] = []
        for row in rows:
            doc = row.get("document") or {}; fields = doc.get("fields") or {}
            source = {key: firestore_value(value) for key, value in fields.items()}
            source["id"] = (doc.get("name") or "").rsplit("/", 1)[-1]
            if source.get("nombre") and source.get("url") and source.get("activa") is True:
                sources.append(source)
        if sources: return sources
    except Exception as exc:
        print(f"AVISO: no se pudieron leer fuentes de Firebase: {exc}", file=sys.stderr)
    return FALLBACK_SOURCES

def feed_url(source: dict) -> str:
    host = urllib.parse.urlparse(str(source.get("url") or "")).netloc.lower().removeprefix("www.")
    if not host: raise ValueError("URL sin dominio")
    query = f"site:{host}"
    params = urllib.parse.urlencode({"q": query, "hl": "es-419", "gl": "AR", "ceid": "AR:es-419"})
    return f"https://news.google.com/rss/search?{params}"

def parse_date(value: str) -> str:
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None: parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat()
    except Exception:
        return value

def parse_feed(source: dict) -> list[dict]:
    raw = request_bytes(feed_url(source))
    root = ET.fromstring(raw)
    items: list[dict] = []
    amount = max(1, min(10, int(source.get("cantidad") or 2)))
    for node in root.findall("./channel/item"):
        title = clean_html(node.findtext("title") or "")
        link = (node.findtext("link") or "").strip()
        description = clean_html(node.findtext("description") or "")
        published = parse_date(node.findtext("pubDate") or "")
        if not title or not link: continue
        # Google News suele agregar " - Medio" al título. Lo quitamos solo si coincide.
        suffix = f" - {source.get('nombre', '')}"
        if suffix and title.endswith(suffix): title = title[:-len(suffix)].strip()
        items.append({
            "title": title,
            "link": link,
            "summary": description[:320],
            "published": published,
            "source": source.get("nombre"),
            "source_url": source.get("url"),
        })
        if len(items) >= amount: break
    return items

def main() -> int:
    sources = load_active_sources()
    groups: list[dict] = []; errors: list[str] = []
    for source in sources:
        source_type = str(source.get("tipo") or "Web").lower()
        if "facebook" in source_type or "instagram" in source_type:
            continue
        try:
            items = parse_feed(source)
            if items:
                groups.append({
                    "id": source.get("id"), "source": source.get("nombre"),
                    "zone": source.get("zona") or "Noticias", "type": source.get("tipo") or "Web",
                    "homepage": source.get("url"), "items": items,
                })
            else:
                errors.append(f"{source.get('nombre')}: sin noticias recientes")
        except Exception as exc:
            errors.append(f"{source.get('nombre')}: {exc}")
            print(f"AVISO {source.get('nombre')}: {exc}", file=sys.stderr)

    if not groups:
        raise RuntimeError("Ninguna fuente devolvió noticias; se conserva el archivo anterior.")

    zone_order = {"local":0,"regional":1,"provincial":2,"nacional":3,"deportes":4}
    groups.sort(key=lambda g: (zone_order.get(str(g.get("zone","")).lower(), 9), str(g.get("source", ""))))
    data = {
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "ok", "description": "Titulares y enlaces; el contenido completo permanece en el medio original.",
        "groups": groups, "errors": errors,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Noticias: {len(groups)} fuentes y {sum(len(g['items']) for g in groups)} titulares")
    return 0

if __name__ == "__main__":
    try: raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr); raise SystemExit(1)
