#!/usr/bin/env python3
"""
Generate buildings-template.json from game_data/buildings.
    "global_distance_from_capital_speed_propagation": "globalProximityCostModifier",
    "local_distance_from_capital_speed_propagation": "localProximityCostModifier",
    "harbor_suitability": "harborSuitability",
    "local_proximity_source": "localProximitySource",
    "local_distance_from_capital_cost_modifier": "localProximityCostModifier",
  buildings-template.json in output_dir
"""

import json
import os
import sys
from typing import Dict, List, Optional

from game_data_loader import GameDataLoader, GameDataFiles
from game_data_utils import parse_game_data_file


WHITELISTED_MODIFIERS = {
    "local_distance_from_capital_speed_propagation": "localProximityCostModifier",
    "harbor_suitability": "harborSuitability",
    "local_proximity_source": "localProximitySource",
    "local_distance_from_capital_cost_modifier": "localProximityCostModifier",
}


def parse_yes_no(value: Optional[str]) -> bool:
    return str(value).lower() == "yes"



BUILDABLE_EXCLUDED: frozenset[str] = frozenset({
    "kilwan_shipwrights",
    "copenhagen_dockyard",
    "hanseatic_shipwright_guild",
    "lieutenancy",
    "viceroyalty",
    "barcelona_royal_shipyard",
    "ostrog",
    "kings_manor",
    "seljuk_mint",
})


def infer_buildability(building_name: str) -> bool:
    """All buildings are buildable unless explicitly excluded."""
    return building_name not in BUILDABLE_EXCLUDED

def infer_building_type(props: Dict[str, object]) -> str:
    is_rural = parse_yes_no(props.get("rural_settlement"))
    is_town = parse_yes_no(props.get("town"))
    is_city = parse_yes_no(props.get("city"))

    if is_rural and is_town and is_city:
        return "common"
    if is_rural and not is_town and not is_city:
        return "rural"
    if is_town and is_city and not is_rural:
        return "urban"
    if is_city and not is_town and not is_rural:
        return "city"
    if is_town and not is_city and not is_rural:
        return "urban"
    return "common"


def extract_numeric(value: object) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def build_templates_from_files(files: GameDataFiles) -> Dict[str, dict]:
    templates: Dict[str, dict] = {}
    obsolete_links: Dict[str, str] = {}

    building_file_paths = [
        files.capital_buildings,
        files.common_buildings,
        files.port_buildings,
        files.rural_buildings,
        files.town_buildings,
        files.unique_buildings,
    ]
    for file_path in building_file_paths:
        parsed = parse_game_data_file(file_path)
        if not isinstance(parsed, dict):
            continue


        for building_name, props in parsed.items():
            if not isinstance(props, dict):
                continue

            modifier_block = props.get("modifier")
            if not isinstance(modifier_block, dict):
                continue

            modifiers: Dict[str, Optional[float]] = {}
            for raw_key, field_name in WHITELISTED_MODIFIERS.items():
                if raw_key in modifier_block:
                    value = extract_numeric(modifier_block.get(raw_key))
                    modifiers[field_name] = value

            if not modifiers:
                continue

            max_levels = props.get("max_levels")
            cap = extract_numeric(max_levels)

            # Transform location_potential to IPlacementRestrictionConfig
            placementRestriction = None
            location_potential = props.get("location_potential")
            restriction_map = {
                "is_coastal": "is_coastal",
                "is_port": "is_coastal",
                "has_river": "has_river",
                "is_adjacent_to_lake": "is_adjacent_to_lake",
                "has_road": "has_road",
                "num_roads": "has_road",
                "is_capital": "is_capital",
            }

            def extract_conditions(block):
                conditions = []
                for k, v in block.items():
                    mapped = restriction_map.get(k)
                    if mapped:
                        if k == "is_capital": # special handling for capital, as we want to output a different restriction depending on yes / no
                            if (isinstance(v, str) and v.lower() == "no") or (v == 0):
                                conditions.append("is_not_capital")
                            elif (isinstance(v, str) and v.lower() == "yes") or (isinstance(v, (int, float)) and v > 0):
                                conditions.append("is_capital")
                        elif (isinstance(v, str) and v.lower() == "yes") or (isinstance(v, (int, float)) and v > 0):
                            conditions.append(mapped)
                    elif k == "!" and v == "this": # special handling for the weird notation used ("owner.capital != this") for local governors
                        conditions.append("is_not_capital")
                    elif isinstance(v, dict):
                        if k == "OR":
                            or_conditions = extract_conditions(v)
                            if or_conditions:
                                conditions.append({"op": "OR", "conditions": sorted(list(set(or_conditions)))})
                        elif k == "AND":
                            and_conditions = extract_conditions(v)
                            if and_conditions:
                                conditions.extend(and_conditions)
                return conditions

            if isinstance(location_potential, dict):
                top_conditions = extract_conditions(location_potential)
                simple_conditions = [c for c in top_conditions if isinstance(c, str)]
                or_blocks = [c for c in top_conditions if isinstance(c, dict) and c.get("op") == "OR"]
                if simple_conditions or or_blocks:
                    if or_blocks:
                        placementRestriction = {
                            "op": "AND",
                            "conditions": simple_conditions + or_blocks
                        }
                    else:
                        placementRestriction = {
                            "op": "AND",
                            "conditions": sorted(list(set(simple_conditions)))
                        }

            templates[building_name] = {
                "name": building_name,
                "type": infer_building_type(props),
                "upgrade": None,
                "downgrade": None,
                "cap": cap,
                "modifiers": modifiers,
                "placementRestriction": placementRestriction,
                "buildable": infer_buildability(building_name),
            }

            obsolete = props.get("obsolete")
            if isinstance(obsolete, str) and obsolete:
                obsolete_links[building_name] = obsolete

    for building_name, obsolete in obsolete_links.items():
        if building_name in templates:
            templates[building_name]["downgrade"] = obsolete
        if obsolete in templates:
            templates[obsolete]["upgrade"] = building_name


    return templates


def generate_buildings_template(
    version: str,
    output_dir: Optional[str],
    source: str = "app",
    game_root_path: Optional[str] = None
) -> Dict[str, dict]:
    loader = GameDataLoader(source=source, game_root_path=game_root_path)
    files = loader.get_game_files_for_version(version)
    templates = build_templates_from_files(files)

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "buildings-template.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(templates, f, separators=(",", ":"))

    return templates


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python generate_buildings_template.py <version> [output_dir]", file=sys.stderr)
        raise SystemExit(1)
    version = sys.argv[1]
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, "output", version)

    generate_buildings_template(version, output_dir)


if __name__ == "__main__":
    main()
