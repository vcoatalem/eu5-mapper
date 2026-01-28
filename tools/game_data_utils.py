"""
Utility functions for loading and parsing game data files.
"""
import re
from typing import Dict, Set, List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class LocationHierarchy:
    """Location hierarchy data."""
    continent: str
    subcontinent: str
    region: str
    area: str
    province: str


@dataclass
class LocationCoordinates:
    """Location city coordinates."""
    x: float
    y: float


@dataclass
class LocationData:
    """Data for a location template."""
    topography: Optional[str]
    vegetation: Optional[str]
    climate: Optional[str]
    natural_harbor_suitability: float


@dataclass
class DevelopmentRules:
    """Development rules configuration."""
    base: int
    coastal: float
    river: float
    road: int
    locationRank: Dict[str, int]  # e.g., {'city': 5, 'town': 2}
    vegetation: Dict[str, int]  # e.g., {'grasslands': 1, 'farmland': 3}
    climate: Dict[str, int]  # e.g., {'tropical': -3, 'subtropical': 2}
    topography: Dict[str, int]  # e.g., {'flatland': 1, 'mountains': -3}
    regions: Dict[str, int]  # e.g., {'italy_region': 25}
    areas: Dict[str, int]  # e.g., {'svealand_area': 4}
    provinces: Dict[str, int]  # e.g., {'dublin_province': 3}
    uniqueLocations: Dict[str, int]  # e.g., {'venice': 7}


def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    """Convert hex string to RGB tuple."""
    hex_str = hex_str.strip().lstrip('#')
    
    # Pad with leading zeros if needed (e.g., "1e05" -> "001e05")
    if len(hex_str) < 6:
        hex_str = hex_str.zfill(6)
    
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))


def load_color_to_name_mapping(color_mapping_file: str) -> Tuple[Dict[Tuple[int, int, int], str], Dict[str, Tuple[int, int, int]]]:
    """Load mapping from hex colors to location names."""
    color_to_name = {}
    name_to_color = {}
    
    with open(color_mapping_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            # Format: location_name = hex_color
            if '=' in line:
                parts = line.split('=')
                if len(parts) == 2:
                    name = parts[0].strip()
                    hex_color = parts[1].strip()
                    rgb = hex_to_rgb(hex_color)
                    color_to_name[rgb] = name
                    name_to_color[name] = rgb
    
    return color_to_name, name_to_color


def parse_default_map(default_map_file: str) -> Tuple[Set[str], Set[str]]:
    """Parse default.map file to extract sea zones and lakes."""
    sea_zones = set()
    lakes = set()
    
    with open(default_map_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract sea_zones
    if 'sea_zones = {' in content:
        start = content.index('sea_zones = {')
        # Find the closing brace
        brace_count = 0
        i = start + len('sea_zones = {')
        start_content = i
        while i < len(content):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                if brace_count == 0:
                    break
                brace_count -= 1
            i += 1
        
        sea_zones_content = content[start_content:i]
        # Extract location names (space or newline separated, ignoring comments)
        for line in sea_zones_content.split('\n'):
            # Remove comments
            if '#' in line:
                line = line[:line.index('#')]
            words = line.split()
            sea_zones.update(words)
    
    # Extract lakes
    if 'lakes = {' in content:
        start = content.index('lakes = {')
        brace_count = 0
        i = start + len('lakes = {')
        start_content = i
        while i < len(content):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                if brace_count == 0:
                    break
                brace_count -= 1
            i += 1
        
        lakes_content = content[start_content:i]
        for line in lakes_content.split('\n'):
            if '#' in line:
                line = line[:line.index('#')]
            words = line.split()
            lakes.update(words)
    
    return sea_zones, lakes


def parse_location_templates(location_templates_file: str) -> Dict[str, LocationData]:
    """Parse location_templates.txt to extract location properties including topography and natural_harbor_suitability."""
    location_data = {}
    
    with open(location_templates_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            # Format: location_name = { topography = type ... natural_harbor_suitability = 0.75 }
            if '=' in line and '{' in line:
                parts = line.split('=', 1)
                if len(parts) == 2:
                    name = parts[0].strip()
                    properties_str = parts[1].strip()
                    
                    # Extract topography value
                    topography = None
                    if 'topography' in properties_str:
                        # Find "topography = value" pattern
                        topo_start = properties_str.index('topography')
                        topo_section = properties_str[topo_start:]
                        # Get the value after "topography = "
                        if '=' in topo_section:
                            topo_value_section = topo_section.split('=', 1)[1].strip()
                            # Extract the first word (before space or other property)
                            topography = topo_value_section.split()[0].strip()
                    
                    # Extract vegetation value
                    vegetation = None
                    if 'vegetation' in properties_str:
                        veg_start = properties_str.index('vegetation')
                        veg_section = properties_str[veg_start:]
                        if '=' in veg_section:
                            veg_value_section = veg_section.split('=', 1)[1].strip()
                            vegetation = veg_value_section.split()[0].strip()
                    
                    # Extract climate value
                    climate = None
                    if 'climate' in properties_str:
                        climate_start = properties_str.index('climate')
                        climate_section = properties_str[climate_start:]
                        if '=' in climate_section:
                            climate_value_section = climate_section.split('=', 1)[1].strip()
                            climate = climate_value_section.split()[0].strip()
                    
                    # Extract natural_harbor_suitability value
                    harbor_suitability = 0.0
                    if 'natural_harbor_suitability' in properties_str:
                        harbor_start = properties_str.index('natural_harbor_suitability')
                        harbor_section = properties_str[harbor_start:]
                        if '=' in harbor_section:
                            harbor_value_section = harbor_section.split('=', 1)[1].strip()
                            # Extract the numeric value (before space, '}', or end of line)
                            harbor_value_str = harbor_value_section.split()[0].strip().rstrip('}')
                            try:
                                harbor_suitability = float(harbor_value_str)
                            except ValueError:
                                pass  # Keep default 0.0
                    
                    location_data[name] = LocationData(
                        topography=topography,
                        vegetation=vegetation,
                        climate=climate,
                        natural_harbor_suitability=harbor_suitability
                    )
    
    return location_data


def parse_pops_file(pops_file: str) -> Dict[str, int]:
    """
    Parse pops file to extract population mapping.
    
    Returns:
        dict: Mapping of location_name -> total_population (in actual numbers, converted from 1e3 format)
    """
    location_populations = {}
    current_location = None
    
    with open(pops_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue
            
            # Check for location definition: "location_name = {"
            if '=' in line and '{' in line and 'define_pop' not in line:
                parts = line.split('=', 1)
                if len(parts) == 2:
                    location_name = parts[0].strip()
                    # Start tracking this location
                    current_location = location_name
                    location_populations[current_location] = 0
            
            # Check for closing brace (end of location)
            elif line == '}' and current_location:
                current_location = None
            
            # Check for pop definition with size
            elif current_location and 'size' in line:
                # Extract size value: "size = 10.474"
                if 'size' in line and '=' in line:
                    parts = line.split('size')
                    if len(parts) > 1:
                        size_part = parts[1].strip()
                        if '=' in size_part:
                            size_str = size_part.split('=')[1].strip()
                            # Extract just the number (before any spaces or other tokens)
                            size_str = size_str.split()[0].strip()
                            try:
                                # Convert from 1e3 format: 10.474 -> 10474
                                size_float = float(size_str)
                                size_actual = int(size_float * 1000)
                                location_populations[current_location] += size_actual
                            except ValueError:
                                pass  # Skip invalid numbers
    
    return location_populations


def parse_roads_file(roads_file: str) -> List[Tuple[str, str]]:
    """
    Parse roads file to extract road connections.
    
    Returns:
        list: List of tuples (location1, location2) where location1 < location2 alphabetically.
              Deduplicates bidirectional roads.
    """
    roads = set()
    
    with open(roads_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            # Skip empty lines, comments, and section headers
            if not line or line.startswith('#') or line == 'road_network = {' or line == '}':
                continue
            
            # Format: "location1 = location2"
            if '=' in line:
                parts = line.split('=')
                if len(parts) == 2:
                    loc1 = parts[0].strip()
                    loc2 = parts[1].strip()
                    
                    # Normalize order (alphabetically)
                    if loc1 < loc2:
                        roads.add((loc1, loc2))
                    else:
                        roads.add((loc2, loc1))
    
    return sorted(list(roads))


def parse_development_file(development_file: str) -> DevelopmentRules:
    """
    Parse development file to extract development rules.
    
    Returns:
        DevelopmentRules: Development rules with all categories
    """
    development_data = {
        'base': 0,
        'coastal': 0.0,
        'river': 0.0,
        'road': 0,
        'locationRank': {},
        'vegetation': {},
        'climate': {},
        'topography': {},
        'regions': {},
        'areas': {},
        'provinces': {},
        'uniqueLocations': {}
    }
    
    current_section = None
    
    with open(development_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Remove comments
            if '#' in line:
                line = line[:line.index('#')].strip()
                if not line:
                    continue
            
            # Skip the opening brace
            if line == 'development = {' or line == '}':
                continue
            
            # Parse key = value pairs
            if '=' in line:
                parts = line.split('=', 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    value_str = parts[1].strip()
                    
                    try:
                        # Try to parse as number
                        if '.' in value_str:
                            value = float(value_str)
                        else:
                            value = int(value_str)
                    except ValueError:
                        continue
                    
                    # Categorize the key
                    if key == 'base':
                        development_data['base'] = value
                    elif key == 'coastal':
                        development_data['coastal'] = value
                    elif key == 'river':
                        development_data['river'] = value
                    elif key == 'road':
                        development_data['road'] = value
                    elif key in ['city', 'town']:
                        development_data['locationRank'][key] = value
                    elif key in ['grasslands', 'farmland', 'sparse', 'forest', 'woods', 'desert', 'jungle']:
                        development_data['vegetation'][key] = value
                    elif key in ['tropical', 'subtropical', 'oceanic', 'arid', 'cold_arid', 'mediterranean', 'continental', 'arctic']:
                        development_data['climate'][key] = value
                    elif key in ['flatland', 'mountains', 'hills', 'plateau', 'wetlands']:
                        development_data['topography'][key] = value
                    elif '_region' in key:
                        development_data['regions'][key] = value
                    elif '_area' in key:
                        development_data['areas'][key] = value
                    elif '_province' in key:
                        development_data['provinces'][key] = value
                    else:
                        # Unique locations
                        development_data['uniqueLocations'][key] = value
    
    return DevelopmentRules(**development_data)


def parse_cities_and_buildings_file(cities_buildings_file: str, whitelisted_buildings: Optional[Set[str]] = None) -> Tuple[Dict[str, str], Dict[str, List[str]]]:
    """
    Parse cities and buildings file to extract location ranks and buildings.
    
    Args:
        cities_buildings_file: Path to the cities and buildings file
        whitelisted_buildings: Set of building names to keep (default: None keeps all)
    
    Returns:
        tuple: (location_ranks dict, location_buildings dict)
            - location_ranks: {location_name: rank}
            - location_buildings: {location_name: [building_names]}
    """
    if whitelisted_buildings is None:
        whitelisted_buildings = {'wharf', 'fishing_village', 'dock', 'bridge_infrastructure'}
    
    location_ranks = {}
    location_buildings = {}
    
    with open(cities_buildings_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse location ranks
    in_locations_section = False
    for line in content.split('\n'):
        line = line.strip()
        
        # Skip empty lines and comments
        if not line or line.startswith('#'):
            continue
        
        # Check if we're in the locations section
        if line == 'locations={':
            in_locations_section = True
            continue
        elif in_locations_section and line == '}':
            break
        
        # Parse location entries with rank
        if in_locations_section and 'rank' in line and '=' in line:
            # Format: "location_name = { rank = city/town ... }"
            parts = line.split('=', 1)
            if len(parts) == 2:
                location_name = parts[0].strip()
                properties = parts[1].strip()
                
                # Extract rank
                if 'rank' in properties:
                    rank_match = properties.split('rank')[1].strip()
                    if '=' in rank_match:
                        rank_value = rank_match.split('=')[1].strip().split()[0]
                        location_ranks[location_name] = rank_value
    
    # Parse buildings
    in_buildings_section = False
    for line in content.split('\n'):
        line = line.strip()
        
        # Skip empty lines and comments
        if not line or line.startswith('#'):
            continue
        
        # Check for building definitions (outside locations section)
        # Format: "building_name = { tag = XXX level = N location = location_name }"
        for building_name in whitelisted_buildings:
            if line.startswith(building_name + ' =') or line.startswith(building_name + '\t='):
                # Extract location
                if 'location' in line:
                    location_part = line.split('location')[1].strip()
                    if '=' in location_part:
                        location_name = location_part.split('=')[1].strip().split()[0]
                        
                        # Add building to location
                        if location_name not in location_buildings:
                            location_buildings[location_name] = []
                        location_buildings[location_name].append(building_name)
                break
    
    return location_ranks, location_buildings


def parse_location_classification(classification_file: str) -> Tuple[Set[str], Set[str]]:
    """
    Parse location classification file for non-ownable and impassable mountains.
    
    Returns:
        tuple: (non_ownable, impassable_mountains) sets of location names
    """
    non_ownable = set()
    impassable_mountains = set()
    current_section = None
    
    with open(classification_file, 'r', encoding='utf-8') as f:
        for line in f:
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


def parse_location_hierarchy(hierarchy_file: str) -> Dict[str, LocationHierarchy]:
    """
    Parse location hierarchy file (definitions.txt).
    
    Returns:
        Dict mapping location name to LocationHierarchy
    """
    location_hierarchy = {}
    
    with open(hierarchy_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split("\n")
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
                hierarchy_value = LocationHierarchy(
                    continent=hierarchy_stack[0] if len(hierarchy_stack) > 0 else "",
                    subcontinent=hierarchy_stack[1] if len(hierarchy_stack) > 1 else "",
                    region=hierarchy_stack[2] if len(hierarchy_stack) > 2 else "",
                    area=hierarchy_stack[3] if len(hierarchy_stack) > 3 else "",
                    province=hierarchy_stack[4] if len(hierarchy_stack) > 4 else "",
                )
                
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
            
            hierarchy_value = LocationHierarchy(
                continent=hierarchy_stack[0] if len(hierarchy_stack) > 0 else "",
                subcontinent=hierarchy_stack[1] if len(hierarchy_stack) > 1 else "",
                region=hierarchy_stack[2] if len(hierarchy_stack) > 2 else "",
                area=hierarchy_stack[3] if len(hierarchy_stack) > 3 else "",
                province=hierarchy_stack[4] if len(hierarchy_stack) > 4 else "",
            )
            
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


def parse_city_coordinates(coordinates_file: str) -> Dict[str, LocationCoordinates]:
    """
    Parse city coordinates file.
    
    Returns:
        Dict mapping location name to LocationCoordinates
    """
    location_coordinates = {}
    current_location_id = None
    
    with open(coordinates_file, 'r', encoding='utf-8') as f:
        for line in f:
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
                location_coordinates[current_location_id] = LocationCoordinates(x=x, y=y)
                current_location_id = None
    
    return location_coordinates
