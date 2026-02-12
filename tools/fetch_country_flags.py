#!/usr/bin/env python3
"""
Fetch country flag image URLs from the Paradox wiki API and add them to countries-data-map.json.

Run this AFTER generate_static_game_data.py. It reads the existing countries-data-map.json,
fetches the flag URL for each country code from https://eu5.paradoxwikis.com, and writes
the updated JSON back with a "flagUrl" field per country (or null if the request fails).
"""

import json
import os
import urllib.request
import urllib.error
from typing import Optional

FLAG_API_BASE = "https://eu5.paradoxwikis.com/api.php?action=query&format=json&titles=File:Flag_{}.png&prop=imageinfo&iiprop=url"
COUNTRIES_FILENAME = "countries-data-map.json"


def fetch_flag_url(country_code: str) -> Optional[str]:
    """
    Fetch the flag image URL for a country from the Paradox wiki API.
    Returns the URL from imageinfo[0].url, or None if the request fails or URL is not found.
    """
    url = FLAG_API_BASE.format(country_code)
    print(url)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "EU5-MapApp/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, OSError, json.JSONDecodeError, ValueError):
        print(f"Error fetching flag URL for {country_code}: {e}")
        return None
    query = data.get("query") or {}
    pages = query.get("pages") or {}
    for page in pages.values():
        if not isinstance(page, dict):
            continue
        imageinfo = page.get("imageinfo")
        if imageinfo and isinstance(imageinfo, list) and len(imageinfo) > 0:
            first = imageinfo[0]
            if isinstance(first, dict) and "url" in first:
                return first["url"]
    return None


def main(version: str = "0.0.11", output_dir: Optional[str] = None) -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if output_dir is None:
        output_dir = os.path.join(script_dir, "output", version)

    countries_path = os.path.join(output_dir, COUNTRIES_FILENAME)
    if not os.path.isfile(countries_path):
        print(f"❌ Not found: {countries_path}")
        print("   Run generate_static_game_data.py first.")
        raise SystemExit(1)

    print(f"Reading {countries_path}...")
    with open(countries_path, "r", encoding="utf-8") as f:
        countries = json.load(f)

    if not isinstance(countries, dict):
        print("❌ Invalid format: expected a JSON object keyed by country code.")
        raise SystemExit(1)

    print("Fetching flag URLs from Paradox wiki...")
    for code, data in countries.items():
        if not isinstance(data, dict):
            continue
        data["flagUrl"] = fetch_flag_url(code)
        if data["flagUrl"] is None:
            print(f"  (no flag URL for {code})")

    fetched = sum(1 for d in countries.values() if isinstance(d, dict) and d.get("flagUrl") is not None)
    print(f"  Fetched flag URLs for {fetched} countries")

    print(f"Writing {countries_path}...")
    with open(countries_path, "w", encoding="utf-8") as f:
        json.dump(countries, f, separators=(",", ":"))

    print("✓ Country flag URLs updated.")


if __name__ == "__main__":
    import sys
    version = sys.argv[1] if len(sys.argv) > 1 else "0.0.11"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    main(version, output_dir)
