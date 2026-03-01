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
from typing import Any, Dict, Tuple

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


def compute_location_centers(version: str) -> Dict[str, Dict[str, Any]]:
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

    # First pass: identify connected components per location using
    # a union-find (disjoint set) structure over the flattened image.
    print("Identifying connected components per location (this may take a moment)...")

    flat_colors = img_int.ravel()
    total_pixels = flat_colors.size

    # labels[idx] = component id or -1 if pixel doesn't belong to any location
    labels = np.full(total_pixels, -1, dtype=np.int32)
    parents: list[int] = []

    def find(i: int) -> int:
        """Find representative of component i with path compression."""
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    def make_set() -> int:
        comp_id = len(parents)
        parents.append(comp_id)
        return comp_id

    def union(a: int, b: int) -> int:
        ra = find(a)
        rb = find(b)
        if ra == rb:
            return ra
        # Attach higher index to lower index for determinism
        if ra > rb:
            ra, rb = rb, ra
        parents[rb] = ra
        return ra

    # First pass: assign preliminary component labels based on 4-connectivity
    for idx in tqdm(range(total_pixels), desc="First pass (components)", unit="px"):
        color_int = int(flat_colors[idx])
        name = color_int_to_name.get(color_int)
        if not name:
            continue

        y, x = divmod(idx, width)
        comp = -1

        # Check left neighbor
        if x > 0:
            left_idx = idx - 1
            left_color = int(flat_colors[left_idx])
            if color_int_to_name.get(left_color) == name:
                left_label = labels[left_idx]
                if left_label != -1:
                    comp = find(int(left_label))

        # Check upper neighbor
        if y > 0:
            up_idx = idx - width
            up_color = int(flat_colors[up_idx])
            if color_int_to_name.get(up_color) == name:
                up_label = labels[up_idx]
                if up_label != -1:
                    up_root = find(int(up_label))
                    if comp == -1:
                        comp = up_root
                    elif comp != up_root:
                        comp = union(comp, up_root)

        if comp == -1:
            comp = make_set()

        labels[idx] = comp

    # Second pass: compress labels so each pixel points directly to its root
    print("Compressing component labels...")
    for idx in tqdm(range(total_pixels), desc="Second pass (compress)", unit="px"):
        label = int(labels[idx])
        if label != -1:
            labels[idx] = find(label)

    # Third pass: accumulate sums of x/y and counts per location and per component
    print("Accumulating pixel positions per location and component...")
    sums_x: Dict[str, float] = {}
    sums_y: Dict[str, float] = {}
    counts: Dict[str, int] = {}

    component_sums_x: Dict[int, float] = {}
    component_sums_y: Dict[int, float] = {}
    component_counts: Dict[int, int] = {}
    location_components: Dict[str, set[int]] = {}

    for idx in tqdm(range(total_pixels), desc="Third pass (accumulate)", unit="px"):
        comp = int(labels[idx])
        if comp == -1:
            continue

        color_int = int(flat_colors[idx])
        name = color_int_to_name.get(color_int)
        if not name:
            continue

        y, x = divmod(idx, width)

        # Global (per-location) accumulators
        sums_x[name] = sums_x.get(name, 0.0) + float(x)
        sums_y[name] = sums_y.get(name, 0.0) + float(y)
        counts[name] = counts.get(name, 0) + 1

        # Per-component accumulators
        component_sums_x[comp] = component_sums_x.get(comp, 0.0) + float(x)
        component_sums_y[comp] = component_sums_y.get(comp, 0.0) + float(y)
        component_counts[comp] = component_counts.get(comp, 0) + 1

        if name not in location_components:
            location_components[name] = set()
        location_components[name].add(comp)

    print(f"Accumulated pixels for {len(counts)} locations")

    # Compute raw centroids per component (in image coordinates, origin top-left)
    component_centroid: Dict[int, Tuple[float, float]] = {}
    for comp_id, c_count in component_counts.items():
        if c_count == 0:
            continue
        cx = component_sums_x[comp_id] / c_count
        cy = component_sums_y[comp_id] / c_count
        component_centroid[comp_id] = (float(cx), float(cy))

    # For locations without explicit city coordinates we also want
    # a centroid, but we will later "snap" it to the nearest pixel
    # that actually belongs to the location so that the final
    # center lies inside the location area.
    location_centroid: Dict[str, Tuple[float, float]] = {}
    for loc_name, count in counts.items():
        if count == 0:
            continue
        cx = sums_x[loc_name] / count
        cy = sums_y[loc_name] / count
        location_centroid[loc_name] = (float(cx), float(cy))

    # Fourth pass: for each component and each location (for
    # locations without explicit coordinates), find the pixel
    # that is closest to the corresponding centroid. This guarantees
    # that reported centers are inside their location/region.
    print("Selecting representative pixels closest to centroids...")
    best_pixel_for_component: Dict[int, Tuple[int, int]] = {}
    best_dist_for_component: Dict[int, float] = {}

    best_pixel_for_location: Dict[str, Tuple[int, int]] = {}
    best_dist_for_location: Dict[str, float] = {}

    for idx in tqdm(range(total_pixels), desc="Fourth pass (snap centers)", unit="px"):
        comp = int(labels[idx])
        if comp == -1:
            continue

        color_int = int(flat_colors[idx])
        name = color_int_to_name.get(color_int)
        if not name:
            continue

        y, x = divmod(idx, width)

        # Snap per-component centers
        if comp in component_centroid:
            cx, cy = component_centroid[comp]
            dx = float(x) - cx
            dy = float(y) - cy
            dist2 = dx * dx + dy * dy
            prev_best = best_dist_for_component.get(comp)
            if prev_best is None or dist2 < prev_best:
                best_dist_for_component[comp] = dist2
                best_pixel_for_component[comp] = (int(x), int(y))

        # Snap per-location centers (we'll only use this for
        # locations without explicit coordinates later)
        if name in location_centroid:
            lx, ly = location_centroid[name]
            dx_l = float(x) - lx
            dy_l = float(y) - ly
            dist2_l = dx_l * dx_l + dy_l * dy_l
            prev_best_l = best_dist_for_location.get(name)
            if prev_best_l is None or dist2_l < prev_best_l:
                best_dist_for_location[name] = dist2_l
                best_pixel_for_location[name] = (int(x), int(y))

    # Build per-location lists of component centers using the
    # snapped pixels (center of the pixel: +0.5 offset)
    component_centers_by_location: Dict[str, list[Dict[str, float]]] = {}
    for loc_name, comp_ids in location_components.items():
        centers_list: list[Dict[str, float]] = []
        for comp_id in comp_ids:
            best_pixel = best_pixel_for_component.get(comp_id)
            if best_pixel is None:
                continue
            px, py = best_pixel
            centers_list.append({
                "x": round(float(px) + 0.5, 2),
                "y": round(float(py) + 0.5, 2),
            })
        component_centers_by_location[loc_name] = centers_list

    centers: Dict[str, Dict[str, Any]] = {}

    # First, fill in locations with explicit city coordinates (rounded to 2 decimals).
    # Invert the Y coordinate so origin is at the bottom: y' = image_height - y.
    for loc_name, coord in city_coordinates.items():
        x_val = float(coord.x)
        y_val = float(coord.y)
        entry: Dict[str, Any] = {
            "x": round(x_val, 2),
            "y": round(float(height - y_val), 2),
        }

        # If this location has multiple disconnected regions on the map,
        # store one representative coordinate per region in secondaryCoordinates.
        comp_centers = component_centers_by_location.get(loc_name) or []
        if len(comp_centers) > 1:
            entry["secondaryCoordinates"] = comp_centers

        centers[loc_name] = entry

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
        # Start from the centroid in image coordinates (origin top-left)
        # but then move to the closest pixel that actually belongs to
        # this location, so the center is guaranteed to lie inside.
        snapped_pixel = best_pixel_for_location.get(name)
        if snapped_pixel is not None:
            px, py = snapped_pixel
            center_x = float(px) + 0.5
            center_y = float(py) + 0.5
        else:
            # Fallback to raw centroid if, for some reason, we didn't
            # record any pixel (should not normally happen).
            center_x = sums_x[name] / count
            center_y = sums_y[name] / count
        entry: Dict[str, Any] = {
            "x": round(float(center_x), 2),
            "y": round(float(center_y), 2),
        }

        # As above, add secondaryCoordinates when there are multiple regions.
        comp_centers = component_centers_by_location.get(name) or []
        if len(comp_centers) > 1:
            entry["secondaryCoordinates"] = comp_centers

        centers[name] = entry

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
