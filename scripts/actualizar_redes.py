#!/usr/bin/env python3
"""Actualiza publicaciones autorizadas de Facebook e Instagram mediante Meta Graph API."""
from __future__ import annotations
import datetime as dt
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "data" / "redes.json"
TOKEN = os.environ.get("META_PAGE_ACCESS_TOKEN", "").strip()
ACCOUNTS_RAW = os.environ.get("META_ACCOUNTS_JSON", "").strip()
GRAPH_VERSION = os.environ.get("META_GRAPH_VERSION", "v23.0")


def load_previous() -> dict:
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    except Exception:
        return {"items": []}


def get_json(path: str, params: dict) -> dict:
    params = {**params, "access_token": TOKEN}
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "RadioTiempoMuerto/1.0"})
    with urllib.request.urlopen(req, timeout=75) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    previous = load_previous()
    if not TOKEN or not ACCOUNTS_RAW:
        print("Meta todavía no está configurado. Se conserva redes.json sin cambios.")
        return 0
    try:
        accounts = json.loads(ACCOUNTS_RAW)
    except Exception as exc:
        print(f"META_ACCOUNTS_JSON no es JSON válido: {exc}")
        return 0
    items: list[dict] = []
    errors: list[str] = []
    for account in accounts:
        if not account.get("active", True) or not account.get("id"):
            continue
        platform = str(account.get("platform", "facebook")).lower()
        try:
            if platform == "instagram":
                data = get_json(f"{account['id']}/media", {"fields": "caption,media_url,thumbnail_url,permalink,timestamp,media_type", "limit": 3})
                for post in data.get("data", []):
                    items.append({"platform":"instagram","account":account.get("name","Instagram"),"text":post.get("caption", ""),"image":post.get("media_url") or post.get("thumbnail_url"),"link":post.get("permalink"),"published":post.get("timestamp")})
            else:
                data = get_json(f"{account['id']}/posts", {"fields": "message,created_time,permalink_url,full_picture", "limit": 3})
                for post in data.get("data", []):
                    items.append({"platform":"facebook","account":account.get("name","Facebook"),"text":post.get("message", ""),"image":post.get("full_picture"),"link":post.get("permalink_url"),"published":post.get("created_time")})
        except Exception as exc:
            errors.append(f"{account.get('name', account.get('id'))}: {exc}")
    if not items:
        print("No se recibieron publicaciones nuevas. Se conserva el archivo anterior.")
        return 0
    items.sort(key=lambda x: str(x.get("published") or ""), reverse=True)
    result = {"updated_at": dt.datetime.now(dt.timezone.utc).isoformat(), "status": "ok" if not errors else "partial", "description": "Publicaciones obtenidas mediante la API oficial de Meta.", "items": items[:18], "errors": errors}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"Se guardaron {len(result['items'])} publicaciones de redes.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
