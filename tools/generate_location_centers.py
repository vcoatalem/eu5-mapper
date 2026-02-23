#!/usr/bin/env python3
"""
Generate and cache center coordinates for all locations.

This script should be run BEFORE generate_static_game_data.py.

It combines two sources:
  - locations_city_coordinates: authoritative coordinates for locations that have explicit entries
  - locations_map + locations_color_mapping: used to compute geometric centers for locations
    that are missing from locations_city_coordinates.

Results are cached per version in tools/tmp/location_centers_<version>.json so
subsequent runs can reuse the cached data, and also written as a proper
output artifact in game_data/computed_location_centers/{version}/location-centers.json.

Usage:
    python3 generate_location_centers.py <version> [--no-cache]

Examples:
    python3 generate_location_centers.py 1.0.11
    python3 generate_location_centers.py 0.1 --no-cache
"""

import json
import os
import sys
from typing import Dict, Tuple

import numpy as np
from PIL import Image
from tqdm import tqdm

from game_data_utils import load_color_to_name_mapping, parse_city_coordinates


def parse_arguments() -> Tuple[str, bool]: 
    """Parse command line arguments.

    Returns:
        (version, no_cache)
    """
    if len(sys.argv) < 2:
        print("Usage: python generate_location_centers.py <version> [--no-cache]")
        print("Example: python generate_location_centers.py 1.0.11")
        sys.exit(1)

    version = sys.argv[1]
    no_cache = False

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--no-cache":
            no_cache = True
            i += 1
        else:
            i += 1

    return version, no_cache


def compute_location_centers(version: str) -> Dict[str, Dict[str, float]]:
    """Compute center coordinates for all locations for a given version.

    For locations present in locations_city_coordinates, we use the explicit coordinates.
    For all other locations present in the locations map, we compute the geometric
    center (centroid) of all pixels belonging to that location.

    Returns:
        Mapping of location_name -> {"x": float, "y": float}
    """
    print(f"Loading game data for version {version}...")

    from game_data_loader import GameDataLoader
    loader = GameDataLoader()
    files = loader.get_game_files_for_version(version)

    # Load color mapping and explicit city coordinates
    print("Loading color to name mapping...")
    color_to_name_rgb, _ = load_color_to_name_mapping(files.locations_color_mapping)
    print(f"Loaded {len(color_to_name_rgb)} location color mappings")

    print("Parsing city coordinates file...")
    city_coordinates = parse_city_coordinates(files.locations_city_coordinates)
    print(f"Found explicit coordinates for {len(city_coordinates)} locations")

    print("Loading locations image...")
    img = Image.open(files.locations_map).convert("RGB")
    img_array = np.array(img)
    height, width = img_array.shape[:2]
    print(f"Image size: {width}x{height}")

    # Build mapping from packed RGB integer to location name for fast lookup
    print("Preparing color lookup table...")
    color_int_to_name: Dict[int, str] = {}
    for rgb, name in color_to_name_rgb.items():
        # rgb from load_color_to_name_mapping is a tuple (r, g, b)
        if len(rgb) == 3:
            r, g, b = rgb
        elif len(rgb) == 2:
            # Fallback handling for older data: assume missing blue channel = 0
            r, g = rgb
            b = 0
        else:
            continue
        color_int = (int(r) << 16) | (int(g) << 8) | int(b)
        color_int_to_name[color_int] = name

    print("Converting image to packed color integers...")
    img_int = (
        img_array[:, :, 0].astype(np.uint32) << 16
        | img_array[:, :, 1].astype(np.uint32) << 8
        | img_array[:, :, 2].astype(np.uint32)
    )

    # Accumulate sums of x/y and counts per location to compute centroids
    print("Accumulating pixel positions per location (this may take a moment)...")
    sums_x: Dict[str, float] = {}
    sums_y: Dict[str, float] = {}
    counts: Dict[str, int] = {}

    flat_colors = img_int.ravel()
    total_pixels = flat_colors.size

    for idx in tqdm(range(total_pixels), desc="Processing pixels", unit="px"):
        color_int = int(flat_colors[idx])
        name = color_int_to_name.get(color_int)
        if not name:
            continue

        y, x = divmod(idx, width)
        sums_x[name] = sums_x.get(name, 0.0) + float(x)
        sums_y[name] = sums_y.get(name, 0.0) + float(y)
        counts[name] = counts.get(name, 0) + 1

    print(f"Accumulated pixels for {len(counts)} locations")

    centers: Dict[str, Dict[str, float]] = {}

    # First, fill in locations with explicit city coordinates (rounded to 2 decimals).
    # Invert the Y coordinate so origin is at the bottom: y' = image_height - y.
    for loc_name, coord in city_coordinates.items():
        x_val = float(coord.x)
        y_val = float(coord.y)
        centers[loc_name] = {
            "x": round(x_val, 2),
            "y": round(float(height - y_val), 2),
        }

    # Then, compute centroids for remaining locations that appear in the map
    missing_locations = [
        name
        for name in counts.keys()
        if name not in centers
    ]
    print(f"Computing centroids for {len(missing_locations)} locations without explicit coordinates")

    for name in tqdm(missing_locations, desc="Computing centroids", unit="loc"):
        count = counts.get(name, 0)
        if count == 0:
            # No pixels found for this name; skip
            continue
        center_x = sums_x[name] / count
        # no inversion here as we are already dealing with the original image coordinates where (0,0) is top-left
        center_y = sums_y[name] / count
        centers[name] = {
            "x": round(float(center_x), 2),
            "y": round(float(center_y), 2),
        }

    print(f"Total locations with center coordinates: {len(centers)}")
    return centers


def main() -> None:
    version, no_cache = parse_arguments()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    tmp_dir = os.path.join(script_dir, "tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    # Also write a versioned output file under game_data
    project_root = os.path.dirname(script_dir)
    output_dir = os.path.join(project_root, "game_data", "computed_location_centers", version)
    os.makedirs(output_dir, exist_ok=True)

    cache_path = os.path.join(tmp_dir, f"location_centers_{version}.json")
    output_path = os.path.join(output_dir, "location-centers.json")

    # If a cache already exists and --no-cache is NOT set, reuse the cached
    # centers instead of recomputing them, but still write the output file.
    if os.path.exists(cache_path) and not no_cache:
        print(f"Cache file already exists: {cache_path}")
        print("Reusing existing center coordinates from cache. Use --no-cache to force recomputation.")
        with open(cache_path, "r", encoding="utf-8") as f:
            centers = json.load(f)
    else:
        centers = compute_location_centers(version)

        print(f"Writing center coordinates cache to {cache_path}...")
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(centers, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Writing center coordinates output to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(centers, f, ensure_ascii=False, separators=(",", ":"))

    print("✓ Center coordinates generation complete!")


if __name__ == "__main__":
    main()
