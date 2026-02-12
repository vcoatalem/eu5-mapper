"""Shared helpers for loading location inputs."""

import csv
import json
import os
import re
from typing import List, Optional, Set, Tuple


def read_locations_from_adjacency_csv(file_path: str) -> List[str]:
    """Read adjacency CSV and return unique locations for river/port/port-river types."""
    locations_set = set()
    valid_types = {"river", "port", "port-river"}

    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            access_type = (row.get("accessType") or "").lower()
            if access_type in valid_types:
                loc_a = (row.get("locationA") or "").strip()
                loc_b = (row.get("locationB") or "").strip()
                if loc_a:
                    locations_set.add(loc_a)
                if loc_b:
                    locations_set.add(loc_b)

    return sorted(list(locations_set))


def read_locations_from_river_colors_json(file_path: str) -> List[str]:
    """Read river color mapping JSON and return its location keys."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("River colors JSON must be an object of location keys")
    return sorted([key for key in data.keys() if key])


def read_locations_from_templates(file_path: str) -> Tuple[List[str], Set[str]]:
    """Read location_templates and return (all_locations, land_locations_with_culture)."""
    locations: List[str] = []
    land_locations: Set[str] = set()
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or "=" not in line:
                continue
            name_part = line.split("=", 1)[0].strip()
            if not name_part:
                continue
            locations.append(name_part)
            if re.search(r"\bculture\s*=", line):
                land_locations.add(name_part)
    return locations, land_locations


def read_river_image_locations(river_colors_path: str, templates_path: str) -> Tuple[List[str], List[str], Set[str]]:
    """Return (land_river_locations, template_locations, land_locations_with_culture)."""
    river_locations = set(read_locations_from_river_colors_json(river_colors_path))
    templates, land_locations = read_locations_from_templates(templates_path)
    land_river_locations = sorted(land_locations.intersection(river_locations))
    return land_river_locations, templates, land_locations


def _parse_version(version: str) -> Optional[Tuple[int, ...]]:
    parts = version.split(".")
    if not parts:
        return None
    parsed = []
    for part in parts:
        if not part.isdigit():
            return None
        parsed.append(int(part))
    return tuple(parsed)


def resolve_versioned_file(base_dir: str, version: str, filename: str) -> Tuple[str, str]:
    """Return (path, resolved_version) for a versioned file with fallback."""
    requested_path = os.path.join(base_dir, version, filename)
    if os.path.exists(requested_path):
        return requested_path, version

    target_version = _parse_version(version)
    if target_version is None:
        raise FileNotFoundError(f"Invalid version format: {version}")

    candidates = []
    if os.path.isdir(base_dir):
        for entry in os.listdir(base_dir):
            entry_version = _parse_version(entry)
            if entry_version is None:
                continue
            if entry_version < target_version:
                candidates.append((entry_version, entry))

    if not candidates:
        raise FileNotFoundError(
            f"No versioned file found for {filename} under {base_dir}"
        )

    _, best_version = max(candidates, key=lambda item: item[0])
    resolved_path = os.path.join(base_dir, best_version, filename)
    return resolved_path, best_version
