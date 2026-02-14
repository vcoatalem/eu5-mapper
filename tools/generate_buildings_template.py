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

from game_data_loader import GameDataLoader
from game_data_utils import parse_game_data_file


WHITELISTED_MODIFIERS = {
    "global_distance_from_capital_speed_propagation": "globalProximityCostModifier",
    "local_distance_from_capital_speed_propagation": "localProximityCostModifier",
    "harbor_suitability": "harborSuitability",
    "local_proximity_source": "localProximitySource",
    "local_distance_from_capital_cost_modifier": "localProximityCostModifier",
    "global_distance_from_capital_cost_modifier": "globalProximityCostModifier",
}


def parse_yes_no(value: Optional[str]) -> bool:
    return str(value).lower() == "yes"


def infer_buildability(props: Dict[str, object]) -> bool:
    #print("infer buildability for props:", props)
    country_potential = props.get("country_potential")
    #print("country_potential:", country_potential)
    if country_potential:
        return False # for now, dont handle buildings specific to certain countries
    allow = props.get("allow")
    #print("allow block:", allow)
    if not allow:
        return True
    return parse_yes_no(allow.get("always"))

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


def build_templates_from_files(files) -> Dict[str, dict]:
    templates: Dict[str, dict] = {}
    obsolete_links: Dict[str, str] = {}

    building_file_fields = [
        'capital_buildings',
        'common_buildings',
        'port_buildings',
        'rural_buildings',
        'town_buildings',
        'unique_buildings',
    ]
    for field in building_file_fields:
        file_path = getattr(files, field, None)
        if not file_path:
            continue
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
                #print("Extracting conditions from block:", block)
                conditions = []
                for k, v in block.items():
                    mapped = restriction_map.get(k)
                    #print(mapped)
                    if mapped:
                        if (isinstance(v, str) and v.lower() == "yes") or (isinstance(v, (int, float)) and v > 0):
                            conditions.append(mapped)
                    elif isinstance(v, dict):
                        # Nested AND/OR
                        #print(f"Found nested block: {k} with value {v}")
                        if k == "OR":
                            or_conditions = extract_conditions(v)
                            #print("got OR conditions:", or_conditions)
                            if or_conditions:
                                conditions.append({"op": "OR", "conditions": sorted(list(set(or_conditions)))})
                        elif k == "AND":
                            and_conditions = extract_conditions(v)
                            #print("got AND conditions:", and_conditions)
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
                "buildable": infer_buildability(props),
            }

            obsolete = props.get("obsolete")
            if isinstance(obsolete, str) and obsolete:
                obsolete_links[building_name] = obsolete

    for building_name, obsolete in obsolete_links.items():
        if building_name in templates:
            templates[building_name]["downgrade"] = obsolete
        if obsolete in templates:
            templates[obsolete]["upgrade"] = building_name


    # special override for kilwan_shipwrights, as their data seem to be structured differently
    if "kilwan_shipwrights" in templates:
        templates["kilwan_shipwrights"]["buildable"] = False
    if "copenhagen_dockyard" in templates:
        templates["copenhagen_dockyard"]["buildable"] = False

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
    version = sys.argv[1] if len(sys.argv) > 1 else "0.0.11"
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, "output", version)

    generate_buildings_template(version, output_dir)


if __name__ == "__main__":
    main()
