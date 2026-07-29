#!/usr/bin/env python3
"""Actualiza assets/data/noticias.json sin interrumpir la web si una fuente falla."""
from __future__ import annotations

import datetime as dt
import email.utils
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from functools import lru_cache
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

PROJECT_ID = "radio-tiempo-muerto-662a1"
FIREBASE_API_KEY = "AIzaSyC58rAZNDk0IwsP_17Zyuat_RNirVy88So"
FIRESTORE_URL = (
    f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/"
    f"databases/(default)/documents:runQuery?key={FIREBASE_API_KEY}"
)
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "noticias.json"
USER_AGENT = "Mozilla/5.0 RadioTiempoMuerto/2.0 (+https://javier-cdelu.github.io/RadioTM/)"

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

DIRECT_FEEDS = {
    "r2820.com": "https://www.r2820.com/rss",
    "clarin.com": "https://www.clarin.com/rss/lo-ultimo/",
    "ole.com.ar": "https://www.ole.com.ar/rss/ultimas-noticias/",
}

class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
    def handle_data(self, data: str) -> None:
        value = " ".join(data.split())
        if value:
            self.parts.append(value)

def clean_html(value: str) -> str:
    parser = TextExtractor()
    parser.feed(html.unescape(value or ""))
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()

def request_bytes(url: str, *, data: bytes | None = None, content_type: str | None = None) -> bytes:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    }
    if content_type:
        headers["Content-Type"] = content_type
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(
                url, data=data, headers=headers,
                method="POST" if data is not None else "GET"
            )
            with urllib.request.urlopen(req, timeout=75) as response:
                return response.read()
        except Exception as exc:
            last_error = exc
            print(f"AVISO: intento {attempt}/3 falló para {url}: {exc}", file=sys.stderr)
            if attempt < 3:
                time.sleep(attempt * 4)
    raise RuntimeError(f"La fuente no respondió después de 3 intentos: {last_error}")

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
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": "activa"},
                    "op": "EQUAL",
                    "value": {"booleanValue": True},
                }
            },
        }
    }
    try:
        raw = request_bytes(
            FIRESTORE_URL,
            data=json.dumps(body).encode("utf-8"),
            content_type="application/json",
        )
        rows = json.loads(raw)
        sources: list[dict] = []
        for row in rows:
            doc = row.get("document") or {}
            fields = doc.get("fields") or {}
            source = {key: firestore_value(value) for key, value in fields.items()}
            source["id"] = (doc.get("name") or "").rsplit("/", 1)[-1]
            if source.get("nombre") and source.get("url") and source.get("activa") is True:
                sources.append(source)
        if sources:
            print(f"Firebase: {len(sources)} fuentes activas")
            return sources
        print("AVISO: Firebase no devolvió fuentes activas; se usan fuentes iniciales.")
    except Exception as exc:
        print(f"AVISO: no se pudieron leer fuentes de Firebase: {exc}", file=sys.stderr)
    return FALLBACK_SOURCES

def source_host(source: dict) -> str:
    return urllib.parse.urlparse(str(source.get("url") or "")).netloc.lower().removeprefix("www.")

def candidate_feeds(source: dict) -> list[str]:
    host = source_host(source)
    if not host:
        return []
    urls: list[str] = []
    if host in DIRECT_FEEDS:
        urls.append(DIRECT_FEEDS[host])
    query = urllib.parse.urlencode({
        "q": f"site:{host}", "hl": "es-419", "gl": "AR", "ceid": "AR:es-419"
    })
    urls.append(f"https://news.google.com/rss/search?{query}")
    return urls

def parse_date(value: str) -> str:
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat()
    except Exception:
        return value



def absolute_url(value: str, base: str) -> str:
    value = html.unescape((value or '').strip())
    if not value or value.startswith('data:'):
        return ''
    return urllib.parse.urljoin(base, value)


def first_feed_image(node: ET.Element, base: str) -> str:
    # RSS enclosure.
    for enclosure in node.findall('enclosure'):
        url = enclosure.attrib.get('url', '')
        media_type = enclosure.attrib.get('type', '')
        if url and (not media_type or media_type.startswith('image/')):
            return absolute_url(url, base)
    # Media RSS namespaces.
    for tag in (
        '{http://search.yahoo.com/mrss/}content',
        '{http://search.yahoo.com/mrss/}thumbnail',
    ):
        for media in node.findall(tag):
            url = media.attrib.get('url', '')
            media_type = media.attrib.get('type', '')
            medium = media.attrib.get('medium', '')
            if url and (not media_type or media_type.startswith('image/') or medium == 'image'):
                return absolute_url(url, base)
    # Images embedded in the description/content HTML.
    fragments = [
        node.findtext('description') or '',
        node.findtext('{http://purl.org/rss/1.0/modules/content/}encoded') or '',
        node.findtext('{http://www.w3.org/2005/Atom}content') or '',
        node.findtext('{http://www.w3.org/2005/Atom}summary') or '',
    ]
    for fragment in fragments:
        match = re.search(r'<img[^>]+(?:src|data-src)=["\\\']([^"\\\']+)', fragment, re.I)
        if match:
            return absolute_url(match.group(1), base)
    return ''


def extract_meta(html_text: str, base_url: str) -> tuple[str, str, str]:
    image = ''
    canonical = ''
    logo = ''
    patterns = [
        r'<meta[^>]+(?:property|name)=["\\\']og:image(?::secure_url)?["\\\'][^>]+content=["\\\']([^"\\\']+)',
        r'<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+(?:property|name)=["\\\']og:image(?::secure_url)?["\\\']',
        r'<meta[^>]+(?:property|name)=["\\\']twitter:image(?::src)?["\\\'][^>]+content=["\\\']([^"\\\']+)',
        r'<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+(?:property|name)=["\\\']twitter:image(?::src)?["\\\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html_text, re.I)
        if match:
            image = absolute_url(match.group(1), base_url)
            if image:
                break
    match = re.search(r'<link[^>]+rel=["\\\'][^"\\\']*canonical[^"\\\']*["\\\'][^>]+href=["\\\']([^"\\\']+)', html_text, re.I)
    if match:
        canonical = absolute_url(match.group(1), base_url)
    for pattern in (
        r'<link[^>]+rel=["\\\'][^"\\\']*(?:apple-touch-icon|icon)[^"\\\']*["\\\'][^>]+href=["\\\']([^"\\\']+)',
        r'<link[^>]+href=["\\\']([^"\\\']+)["\\\'][^>]+rel=["\\\'][^"\\\']*(?:apple-touch-icon|icon)[^"\\\']*["\\\']',
    ):
        match = re.search(pattern, html_text, re.I)
        if match:
            logo = absolute_url(match.group(1), base_url)
            if logo:
                break
    return image, canonical, logo


@lru_cache(maxsize=80)
def page_metadata(url: str) -> tuple[str, str, str]:
    if not url:
        return '', '', ''
    try:
        raw = request_bytes(url)
        text = raw[:2_500_000].decode('utf-8', errors='ignore')
        return extract_meta(text, url)
    except Exception as exc:
        print(f'AVISO: no se pudo leer imagen/metadatos de {url}: {exc}', file=sys.stderr)
        return '', '', ''


@lru_cache(maxsize=40)
def source_visuals(homepage: str) -> tuple[str, str]:
    image, _, logo = page_metadata(homepage)
    host = urllib.parse.urlparse(homepage).netloc
    favicon = f'https://www.google.com/s2/favicons?domain={urllib.parse.quote(host)}&sz=128' if host else ''
    return image, logo or favicon


def enrich_item_image(item: dict, source: dict) -> dict:
    homepage = str(source.get('url') or '')
    source_image, source_logo = source_visuals(homepage)
    item['source_logo'] = source_logo
    item['source_image'] = source_image
    if item.get('image'):
        return item
    link = str(item.get('link') or '')
    # Direct article pages usually expose og:image. Google News URLs may not,
    # so in that case the source visual becomes the safe fallback.
    article_image, canonical, _ = page_metadata(link)
    if canonical and 'news.google.com' not in urllib.parse.urlparse(canonical).netloc:
        item['link'] = canonical
        if not article_image:
            article_image, _, _ = page_metadata(canonical)
    item['image'] = article_image or source_image or source_logo
    return item

def parse_xml_feed(raw: bytes, source: dict) -> list[dict]:
    root = ET.fromstring(raw)
    nodes = root.findall("./channel/item")
    if not nodes:
        nodes = root.findall("{http://www.w3.org/2005/Atom}entry")
    amount = max(1, min(5, int(source.get("cantidad") or 2)))
    items: list[dict] = []
    seen: set[str] = set()
    for node in nodes:
        title = clean_html(node.findtext("title") or node.findtext("{http://www.w3.org/2005/Atom}title") or "")
        link = (node.findtext("link") or "").strip()
        if not link:
            atom_link = node.find("{http://www.w3.org/2005/Atom}link")
            if atom_link is not None:
                link = (atom_link.attrib.get("href") or "").strip()
        description = clean_html(
            node.findtext("description") or
            node.findtext("{http://www.w3.org/2005/Atom}summary") or ""
        )
        published = parse_date(
            node.findtext("pubDate") or
            node.findtext("{http://www.w3.org/2005/Atom}updated") or ""
        )
        if not title or not link or link in seen:
            continue
        seen.add(link)
        suffix = f" - {source.get('nombre', '')}"
        if suffix and title.endswith(suffix):
            title = title[:-len(suffix)].strip()
        item = {
            "title": title,
            "link": link,
            "summary": description[:320],
            "published": published,
            "source": source.get("nombre"),
            "source_url": source.get("url"),
            "image": first_feed_image(node, link or str(source.get("url") or "")),
        }
        items.append(enrich_item_image(item, source))
        if len(items) >= amount:
            break
    return items

def parse_source(source: dict) -> list[dict]:
    errors: list[str] = []
    for feed in candidate_feeds(source):
        try:
            items = parse_xml_feed(request_bytes(feed), source)
            if items:
                return items
            errors.append(f"{feed}: sin elementos")
        except Exception as exc:
            errors.append(f"{feed}: {exc}")
    raise RuntimeError(" | ".join(errors) or "No hay feed disponible")

def load_previous() -> dict:
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    except Exception:
        return {"groups": []}

def main() -> int:
    previous = load_previous()
    previous_by_id = {str(group.get("id")): group for group in previous.get("groups", [])}
    sources = load_active_sources()
    groups: list[dict] = []
    errors: list[str] = []

    for source in sources:
        source_type = str(source.get("tipo") or "Web").lower()
        if "facebook" in source_type or "instagram" in source_type:
            errors.append(f"{source.get('nombre')}: red social, requiere selección manual")
            continue
        try:
            items = parse_source(source)
            groups.append({
                "id": source.get("id"),
                "source": source.get("nombre"),
                "zone": source.get("zona") or "Noticias",
                "type": source.get("tipo") or "Web",
                "homepage": source.get("url"),
                "items": items,
            })
            print(f"OK {source.get('nombre')}: {len(items)} noticias")
        except Exception as exc:
            msg = f"{source.get('nombre')}: {exc}"
            errors.append(msg)
            print(f"AVISO {msg}", file=sys.stderr)
            old = previous_by_id.get(str(source.get("id")))
            if old and old.get("items"):
                groups.append(old)
                print(f"Se conservan las noticias anteriores de {source.get('nombre')}")

    if not groups:
        print("AVISO: ninguna fuente respondió; se conserva noticias.json sin cambios.")
        return 0

    zone_order = {"local":0, "regional":1, "provincial":2, "nacional":3, "deportes":4}
    groups.sort(key=lambda g: (
        zone_order.get(str(g.get("zone", "")).lower(), 9),
        str(g.get("source", ""))
    ))
    data = {
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "status": "ok" if not errors else "partial",
        "description": "Titulares y enlaces; el contenido completo permanece en el medio original.",
        "groups": groups,
        "errors": errors,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Resultado: {len(groups)} fuentes y {sum(len(g.get('items', [])) for g in groups)} titulares")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR INESPERADO: {exc}", file=sys.stderr)
        raise SystemExit(1)
