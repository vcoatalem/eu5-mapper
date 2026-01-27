#!/usr/bin/env python3
"""
Generate static JSON files from game data sources.
This script parses all game data files and outputs optimized JSON files
that can be loaded directly on the client side, avoiding Next.js hydration overhead.
"""

import json
import os
import re
from typing import Dict, List, Set, Optional
from game_data_loader import GameDataLoader


class GameDataParser:
    """Python implementation of TypeScript GameDataParser"""
    
    @staticmethod
    def parse_location_name_and_color_hex(data: str) -> tuple[dict, dict]:
        """
        Parse location name to hex color mapping.
        
        Returns:
            (name_to_color, color_to_name) tuple
        """
        lines = data.split("\n")
        name_to_color = {}
        color_to_name = {}
        
        for line in lines:
            line = line.strip()
            if line.startswith("#") or not line:
                continue
            
            if "=" not in line:
                continue
            
            location_name, rest = line.split("=", 1)
            if not location_name or not rest:
                continue
            
            # Extract hex code (before any comment)
            hex_code = rest.split("#")[0].strip()
            # Pad to 6 digits
            hex_code = hex_code.zfill(6)
            if not hex_code:
                continue
            
            location_name = location_name.strip()
            color_to_name[hex_code] = location_name
            name_to_color[location_name] = hex_code
        
        return name_to_color, color_to_name
    
    @staticmethod
    def parse_location_data(data: str) -> Dict[str, dict]:
        """
        Parse location topography and vegetation data.
        
        Returns:
            Dict mapping location name to {topography, vegetation}
        """
        lines = data.split("\n")
        result = {}
        
        for line in lines:
            line = line.strip()
            if line.startswith("#") or not line:
                continue
            
            first_equal_index = line.find("=")
            if first_equal_index == -1:
                continue
            
            location_name = line[:first_equal_index].strip()
            rest = line[first_equal_index + 1:].strip()
            
            if not location_name or not rest:
                continue
            
            # Extract topography
            topography_match = re.search(r'topography\s*=\s*(\w+)', rest)
            topography = topography_match.group(1) if topography_match else "unknown"
            
            # Extract vegetation
            vegetation_match = re.search(r'vegetation\s*=\s*(\w+)', rest)
            vegetation = vegetation_match.group(1) if vegetation_match else None
            
            result[location_name] = {
                "topography": topography,
                "vegetation": vegetation
            }
        
        return result
    
    @staticmethod
    def parse_map_config(data: str) -> tuple[Set[str], Set[str]]:
        """
        Parse map configuration for non-ownable and impassable mountains.
        
        Returns:
            (non_ownable, impassable_mountains) tuple of sets
        """
        non_ownable = set()
        impassable_mountains = set()
        current_section = None
        
        lines = data.split("\n")
        for line in lines:
            trimmed = line.strip()
            
            # Check for section headers
            if trimmed.startswith("non_ownable"):
                current_section = "non_ownable"
                continue
            if trimmed.startswith("impassable_mountains"):
                current_section = "impassable_mountains"
                continue
            
            # Check if leaving section
            if trimmed == "}":
                current_section = None
                continue
            
            # Skip comments and empty lines
            if trimmed.startswith("#") or not trimmed:
                continue
            
            # Extract location names
            if current_section:
                location_names = [
                    name for name in trimmed.split()
                    if name and not name.startswith("#")
                ]
                
                if current_section == "non_ownable":
                    non_ownable.update(location_names)
                elif current_section == "impassable_mountains":
                    impassable_mountains.update(location_names)
        
        return non_ownable, impassable_mountains
    
    @staticmethod
    def parse_location_hierarchy(data: str) -> Dict[str, dict]:
        """
        Parse location hierarchy data.
        
        Returns:
            Dict mapping location name to {continent, subcontinent, region, area, province}
        """
        location_hierarchy = {}
        lines = data.split("\n")
        
        hierarchy_stack = []
        inside_province = False
        current_province_locations = []
        
        for line in lines:
            # Skip comments and empty lines
            if line.strip().startswith("#") or not line.strip():
                continue
            
            # Count leading tabs
            leading_tabs = len(line) - len(line.lstrip('\t'))
            
            # Handle closing braces
            if line.strip() == "}":
                if inside_province and current_province_locations:
                    hierarchy_value = {
                        "continent": hierarchy_stack[0] if len(hierarchy_stack) > 0 else "",
                        "subcontinent": hierarchy_stack[1] if len(hierarchy_stack) > 1 else "",
                        "region": hierarchy_stack[2] if len(hierarchy_stack) > 2 else "",
                        "area": hierarchy_stack[3] if len(hierarchy_stack) > 3 else "",
                        "province": hierarchy_stack[4] if len(hierarchy_stack) > 4 else "",
                    }
                    
                    for location_name in current_province_locations:
                        location_hierarchy[location_name] = hierarchy_value
                    
                    current_province_locations = []
                    inside_province = False
                
                if hierarchy_stack:
                    hierarchy_stack.pop()
                continue
            
            # Single-line province: province = { loc1 loc2 ... }
            single_line_match = re.match(r'^\t*(\w+_province)\s*=\s*\{\s*(.+?)\s*\}', line)
            if single_line_match:
                province_name = single_line_match.group(1)
                locations_line = single_line_match.group(2)
                
                # Update hierarchy stack
                if leading_tabs < len(hierarchy_stack):
                    hierarchy_stack = hierarchy_stack[:leading_tabs]
                if leading_tabs >= len(hierarchy_stack):
                    hierarchy_stack.append(province_name)
                else:
                    hierarchy_stack[leading_tabs] = province_name
                
                # Extract location names
                location_names = [
                    name for name in locations_line.split()
                    if name and not name.startswith("#") and name not in ["{", "}"]
                ]
                
                hierarchy_value = {
                    "continent": hierarchy_stack[0] if len(hierarchy_stack) > 0 else "",
                    "subcontinent": hierarchy_stack[1] if len(hierarchy_stack) > 1 else "",
                    "region": hierarchy_stack[2] if len(hierarchy_stack) > 2 else "",
                    "area": hierarchy_stack[3] if len(hierarchy_stack) > 3 else "",
                    "province": hierarchy_stack[4] if len(hierarchy_stack) > 4 else "",
                }
                
                for location_name in location_names:
                    location_hierarchy[location_name] = hierarchy_value
                continue
            
            # Multi-line province start: province = {
            multi_line_match = re.match(r'^\t*(\w+_province)\s*=\s*\{$', line)
            if multi_line_match:
                province_name = multi_line_match.group(1)
                if leading_tabs < len(hierarchy_stack):
                    hierarchy_stack = hierarchy_stack[:leading_tabs]
                if leading_tabs >= len(hierarchy_stack):
                    hierarchy_stack.append(province_name)
                else:
                    hierarchy_stack[leading_tabs] = province_name
                inside_province = True
                current_province_locations = []
                continue
            
            # Opening brace (non-province)
            open_brace_match = re.match(r'^\t*(\w+)\s*=\s*\{', line)
            if open_brace_match and not open_brace_match.group(1).endswith("_province"):
                name = open_brace_match.group(1)
                if leading_tabs < len(hierarchy_stack):
                    hierarchy_stack = hierarchy_stack[:leading_tabs]
                if leading_tabs >= len(hierarchy_stack):
                    hierarchy_stack.append(name)
                else:
                    hierarchy_stack[leading_tabs] = name
                continue
            
            # Collect location names inside province
            if inside_province:
                location_names = [
                    name for name in line.strip().split()
                    if name and not name.startswith("#") and name not in ["{", "}"]
                ]
                current_province_locations.extend(location_names)
        
        return location_hierarchy
    
    @staticmethod
    def parse_city_coordinates(data: str) -> Dict[str, dict]:
        """
        Parse city coordinates.
        
        Returns:
            Dict mapping location name to {x, y}
        """
        location_coordinates = {}
        lines = data.split("\n")
        current_location_id = None
        
        for line in lines:
            trimmed = line.strip()
            
            # Skip comments and empty
            if trimmed.startswith("#") or not trimmed:
                continue
            
            # Check for id line: id=location_name
            id_match = re.match(r'^id=(\w+)', trimmed)
            if id_match:
                current_location_id = id_match.group(1)
                continue
            
            # Check for position line: position={ X Z Y }
            position_match = re.match(r'^position=\{\s*([\d.-]+)\s+[\d.-]+\s+([\d.-]+)\s*\}', trimmed)
            if position_match and current_location_id:
                x = float(position_match.group(1))
                y = float(position_match.group(2))
                location_coordinates[current_location_id] = {"x": x, "y": y}
                current_location_id = None
        
        return location_coordinates


def generate_game_data_json(version: str = "0.0.11", output_dir: str = None):
    """
    Generate static JSON files from game data.
    
    Args:
        version: Game version to load
        output_dir: Output directory (defaults to ../public/{version}/game_data/)
    """
    # Setup paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    if output_dir is None:
        output_dir = os.path.join(project_root, "public", version, "game_data")
    
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Loading game data for version {version}...")
    
    # Load all game data files
    loader = GameDataLoader()
    files = loader.get_game_files_for_version(version)
    
    print("Parsing data files...")
    
    # Parse all data
    with open(files.locations_color_mapping, 'r', encoding='utf-8') as f:
        name_to_color, color_to_name = GameDataParser.parse_location_name_and_color_hex(f.read())
    
    with open(files.location_data, 'r', encoding='utf-8') as f:
        location_data = GameDataParser.parse_location_data(f.read())
    
    with open(files.location_classification, 'r', encoding='utf-8') as f:
        non_ownable, impassable_mountains = GameDataParser.parse_map_config(f.read())
    
    with open(files.provinces_data, 'r', encoding='utf-8') as f:
        hierarchy = GameDataParser.parse_location_hierarchy(f.read())
    
    with open(files.locations_city_coordinates, 'r', encoding='utf-8') as f:
        city_coordinates = GameDataParser.parse_city_coordinates(f.read())
    
    # Load buildings data (already JSON)
    with open(files.buildings_data, 'r', encoding='utf-8') as f:
        buildings_data = json.load(f)
    
    print("Building location data map...")
    
    # Build locationDataMap
    location_data_map = {}
    
    for location_name, data in location_data.items():
        hex_color = name_to_color.get(location_name)
        if not hex_color:
            continue
        
        is_non_ownable = location_name in non_ownable
        is_impassable_mountain = location_name in impassable_mountains
        is_lake = data["topography"] == "lakes"
        is_sea = data["topography"] in [
            "ocean", "coastal_ocean", "inland_sea", 
            "ocean_wasteland", "narrows"
        ]
        
        location_data_map[location_name] = {
            **data,
            "name": location_name,
            "hexColor": hex_color,
            "isLake": is_lake,
            "isSea": is_sea,
            "ownable": not (is_non_ownable or is_impassable_mountain or is_lake or is_sea),
            "hierarchy": hierarchy.get(location_name, {
                "continent": "",
                "subcontinent": "",
                "region": "",
                "area": "",
                "province": ""
            }),
            "constructibleLocationCoordinate": city_coordinates.get(location_name)
        }
    
    # Build buildingsTemplateMap
    buildings_template_map = {
        building["name"]: building
        for building in buildings_data
    }
    
    print("Writing JSON files...")
    
    # Write output files
    output_files = {
        "location-data-map.json": location_data_map,
        "color-to-name-map.json": color_to_name,
        "buildings-template-map.json": buildings_template_map,
    }
    
    total_size = 0
    for filename, data in output_files.items():
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, separators=(',', ':'))  # Compact JSON
        
        file_size = os.path.getsize(filepath)
        total_size += file_size
        print(f"  ✓ {filename}: {file_size / 1024:.1f} KB ({len(data)} entries)")
    
    print(f"\nTotal size: {total_size / 1024:.1f} KB ({total_size / 1024 / 1024:.2f} MB)")
    print(f"Output directory: {output_dir}")
    print("\n✓ Static game data generation complete!")


if __name__ == "__main__":
    import sys
    
    version = sys.argv[1] if len(sys.argv) > 1 else "0.0.11"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    
    generate_game_data_json(version, output_dir)
