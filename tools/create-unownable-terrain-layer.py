#!/usr/bin/env python3
"""
Generate an RGBA layer highlighting non-ownable / impassable terrain.
- Parses location color mapping to resolve names -> hex colors
- Parses default.map to collect non_ownable and impassable_mountains locations
- Fills matching pixels in the color map with a grey overlay (#37363d)

Usage:
  python3 create-unownable-terrain-layer.py <color_map_png>
    [<location_color_map_txt>] [<default_map_file>] [<output_png>]

Defaults (relative to repo root when run from tools/):
  color_map_png: ../public/test/locations.png (must be provided explicitly)
  location_color_map_txt: ../game_data/locations_color_mapping/0.0.11/00_default.txt
  default_map_file: ../game_data/world_map/0.0.11/default.map
  output_png: unownable_layer.png
"""

from __future__ import annotations

import sys
import os
from typing import Dict, Set
from PIL import Image
import numpy as np

GREY_COLOR = "#37363d"


def parse_location_color_map(path: str) -> Dict[str, int]:
    """Return mapping of location name -> RGB int (0xRRGGBB)."""
    mapping: Dict[str, int] = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" not in stripped:
                continue
            # split only on first '='
            name_part, hex_part = stripped.split("=", 1)
            name = name_part.strip()
            hex_str = hex_part.strip().lstrip("#")
            if len(hex_str) < 6:
                continue
            try:
                mapping[name] = int(hex_str[:6], 16)
            except ValueError:
                continue
    return mapping


def parse_default_map(path: str) -> tuple[Set[str], Set[str]]:
    """Return sets (non_ownable, impassable_mountains)."""
    non_ownable: Set[str] = set()
    impassable: Set[str] = set()

    current = None  # type: str | None
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("non_ownable"):
                current = "non_ownable"
                continue
            if line.startswith("impassable_mountains"):
                current = "impassable_mountains"
                continue
            if line == "}":
                current = None
                continue
            if current in ("non_ownable", "impassable_mountains"):
                # tokenize on whitespace
                for token in line.split():
                    if token.startswith("#"):
                        break
                    if current == "non_ownable":
                        non_ownable.add(token)
                    else:
                        impassable.add(token)
    return non_ownable, impassable


def build_mask(color_map_png: str, target_colors: Set[int]) -> np.ndarray:
    img = Image.open(color_map_png).convert("RGB")
    img_array = np.array(img)
    height, width = img_array.shape[:2]

    color_ints = (
        img_array[:, :, 0].astype(np.uint32) << 16
        | img_array[:, :, 1].astype(np.uint32) << 8
        | img_array[:, :, 2].astype(np.uint32)
    )

    mask = np.isin(color_ints, list(target_colors))
    return mask.astype(np.uint8), width, height


def write_overlay(mask: np.ndarray, width: int, height: int, output_png: str):
    grey_r = int(GREY_COLOR[1:3], 16)
    grey_g = int(GREY_COLOR[3:5], 16)
    grey_b = int(GREY_COLOR[5:7], 16)

    output_array = np.zeros((height, width, 4), dtype=np.uint8)
    output_array[mask.astype(bool)] = [grey_r, grey_g, grey_b, 255]

    out_img = Image.fromarray(output_array, "RGBA")
    out_img.save(output_png)


def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: python3 create-unownable-terrain-layer.py <color_map_png> [location_color_map_txt] [default_map_file] [output_png]")
        sys.exit(1)

    color_map_png = args[0]
    location_color_map_txt = args[1] if len(args) > 1 else "../game_data/locations_color_mapping/0.0.11/00_default.txt"
    default_map_file = args[2] if len(args) > 2 else "../game_data/world_map/0.0.11/default.map"
    output_png = args[3] if len(args) > 3 else "unownable_layer.png"

    if not os.path.exists(color_map_png):
        print(f"Color map not found: {color_map_png}")
        sys.exit(1)
    if not os.path.exists(location_color_map_txt):
        print(f"Location color map not found: {location_color_map_txt}")
        sys.exit(1)
    if not os.path.exists(default_map_file):
        print(f"default.map not found: {default_map_file}")
        sys.exit(1)

    print("Parsing location color map...")
    name_to_color = parse_location_color_map(location_color_map_txt)
    print(f"Loaded {len(name_to_color)} location colors")

    print("Parsing default.map...")
    non_ownable, impassable = parse_default_map(default_map_file)
    targets = non_ownable | impassable
    print(f"Found {len(non_ownable)} non_ownable and {len(impassable)} impassable locations")

    target_colors = set()
    missing = []
    for name in targets:
        color = name_to_color.get(name)
        if color is None:
            missing.append(name)
        else:
            target_colors.add(color)

    if missing:
        print(f"Warning: {len(missing)} locations missing color mapping (ignored). Example: {missing[:5]}")

    print(f"Computing mask over {color_map_png}...")
    mask, width, height = build_mask(color_map_png, target_colors)
    print(f"Mask pixels set: {int(mask.sum())}")

    print(f"Writing overlay to {output_png}...")
    write_overlay(mask, width, height, output_png)
    print("Done.")


if __name__ == "__main__":
    main()
