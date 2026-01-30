"""
Utility functions for loading and parsing game data files.
"""
import io
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


@dataclass
class CountryData:
    locations: list[str]
    centralizationVsDecentralization: float # -100 to 100, -100 is full land, 100 is full naval
    landVsNaval: float # -100 to 100. -100 is full land, 100 is full naval
    capital: str

def parse_game_data_file(filepath: str) -> dict:
    """
    Parse a custom game data file into a nested dict/list structure.
    Handles nested objects and lists spanning multiple lines.
    """
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    return _parse_game_data(io.StringIO(content))

def _parse_game_data(f) -> dict:
    def parse_value(token_iter):
        for token in token_iter:
            if token == '{':
                # Could be a list or an object
                # Peek ahead to see if it's a list (no = inside)
                items = []
                obj = {}
                is_object = False
                sub_tokens = []
                depth = 1
                for t in token_iter:
                    if t == '{':
                        depth += 1
                    elif t == '}':
                        depth -= 1
                        if depth == 0:
                            break
                    sub_tokens.append(t)
                # If any '=' in sub_tokens, treat as object
                if '=' in sub_tokens:
                    # Recurse as object
                    return _parse_game_data(io.StringIO(' '.join(sub_tokens)))
                else:
                    # List
                    return [x for x in sub_tokens if x not in ['{', '}']]
            elif token == '}':
                return None
            elif token == '=':
                continue
            else:
                # Try to parse as number
                try:
                    if '.' in token:
                        return float(token)
                    else:
                        return int(token)
                except ValueError:
                    return token

    def tokenize_lines(f):
        for line in f:
            # Remove comments
            line = line.split('#', 1)[0].strip()
            if not line:
                continue
            # Tokenize: split on whitespace, keep braces and = as separate tokens
            tokens = []
            buf = ''
            for c in line:
                if c in '{}=':
                    if buf:
                        tokens.append(buf)
                        buf = ''
                    tokens.append(c)
                elif c.isspace():
                    if buf:
                        tokens.append(buf)
                        buf = ''
                else:
                    buf += c
            if buf:
                tokens.append(buf)
            for t in tokens:
                yield t

    tokens = list(tokenize_lines(f))
    i = 0
    result = {}
    while i < len(tokens):
        if tokens[i] == '}':
            break
        if i+2 < len(tokens) and tokens[i+1] == '=':
            key = tokens[i]
            if tokens[i+2] == '{':
                # Find matching closing brace
                depth = 1
                j = i+3
                while j < len(tokens):
                    if tokens[j] == '{':
                        depth += 1
                    elif tokens[j] == '}':
                        depth -= 1
                        if depth == 0:
                            break
                    j += 1
                value_tokens = tokens[i+2:j+1]
                value = parse_value(iter(value_tokens))
                # Store repeated keys as lists
                if key in result:
                    if isinstance(result[key], list):
                        result[key].append(value)
                    else:
                        result[key] = [result[key], value]
                else:
                    result[key] = value
                i = j+1
            else:
                value = parse_value(iter([tokens[i+2]]))
                if key in result:
                    if isinstance(result[key], list):
                        result[key].append(value)
                    else:
                        result[key] = [result[key], value]
                else:
                    result[key] = value
                i += 3
        else:
            i += 1
    return result


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
    parsed = parse_game_data_file(pops_file)
    locations = parsed.get('locations', {})
    for location, data in locations.items():
        total = 0
        # data may be a dict with multiple define_pop entries (as lists or dicts)
        if isinstance(data, dict):
            # If 'define_pop' is a list, sum all sizes
            pops = data.get('define_pop', [])
            if isinstance(pops, dict):
                pops = [pops]
            for pop in pops:
                if isinstance(pop, dict) and 'size' in pop:
                    try:
                        size_float = float(pop['size'])
                        size_actual = int(size_float * 1000)
                        total += size_actual
                    except Exception:
                        pass
        location_populations[location] = total
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
    parsed = parse_game_data_file(cities_buildings_file)

    # Parse location ranks
    locations = parsed.get('locations', {})
    if isinstance(locations, dict):
        for location_name, props in locations.items():
            if isinstance(props, dict) and 'rank' in props:
                location_ranks[location_name] = props['rank']

    # Parse buildings
    for building_name in whitelisted_buildings:
        building_data = parsed.get(building_name)
        if isinstance(building_data, dict) and 'location' in building_data:
            location_name = building_data['location']
            if location_name not in location_buildings:
                location_buildings[location_name] = []
            location_buildings[location_name].append(building_name)

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
    # Use the robust parser to get a nested dict
    parsed = parse_game_data_file(hierarchy_file)
    location_hierarchy = {}

    def traverse(obj, stack):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.endswith('_province') and isinstance(v, list):
                    # Province: v is a list of locations
                    full_stack = stack + [k]
                    # Pad or trim to 5 levels
                    padded = (full_stack + [''] * 5)[:5]
                    for loc in v:
                        location_hierarchy[loc] = LocationHierarchy(
                            continent=padded[0],
                            subcontinent=padded[1],
                            region=padded[2],
                            area=padded[3],
                            province=padded[4],
                        )
                elif k.endswith('_province') and isinstance(v, dict):
                    # Province with nested structure (rare)
                    traverse(v, stack + [k])
                elif isinstance(v, dict):
                    traverse(v, stack + [k])
        # lists are not expected at non-leaf nodes

    traverse(parsed, [])
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


def parse_countries_files(country_file: str, whitelisted_countries: list) -> Dict[str, CountryData]:
    parsed = parse_game_data_file(country_file)
    countriesDict = {}

    # Drill down to countries['countries']
    countries_data = parsed.get("countries", {}).get("countries", {})

    for code in whitelisted_countries:
        print("will try to get country:", code)
        country = countries_data.get(code)
        print("got country:", country)
        if not country or not isinstance(country, dict):
            continue
        locations = list(sorted(set([
            loc
            for key in ["own_control_core", "own_control_integrated", "own_control_conquered"]
            for loc in country.get(key, [])
        ])))
        # Extract from government block
        government = country.get("government", {})
        if isinstance(government, dict):
            centralization = government.get("centralization_vs_decentralization", 0.0)
            land_naval = government.get("land_vs_naval", 0.0)
        else:
            centralization = 0.0
            land_naval = 0.0
        capital = country.get("capital", "")
        countriesDict[code] = CountryData(
            locations=locations,
            centralizationVsDecentralization=centralization,
            landVsNaval=land_naval,
            capital=capital
        )
    return countriesDict