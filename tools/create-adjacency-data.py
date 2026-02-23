#!/usr/bin/env python3
"""
Script to generate adjacency data between locations based on:
- A locations map image (unique color per area)
- A rivers map image (showing rivers, sea, and land)
- Location name to color mapping file
- Default map file (containing sea zones and lakes lists)
- Ports CSV file (land-to-sea connections)

Outputs: CSV file with location pairs and their connection type
"""

import sys
import csv
import time
import os
import json
import hashlib
from pathlib import Path
from PIL import Image
import numpy as np
from collections import defaultdict
from scipy import ndimage
from tqdm import tqdm
from game_data_loader import GameDataLoader
from game_data_utils import load_color_to_name_mapping, parse_default_map, parse_location_templates

# Expected adjacency results for validation.
# Each entry is [locationA, locationB, accessType].
# The pair is treated as unordered; validation will normalize the order
# to match the CSV output convention (alphabetical by location name).
expected_results = [
        ['antwerp', 'sint_niklaas', 'land'],
        ['antwerp', 'mechelen', 'river'],
        ['london', 'thames', 'port-river'],
        ['oslo', 'oslo_fjord', 'port'],
        ['bragernes', 'oslo_fjord', 'port-river'],
        ['aalst', 'ath', 'river'],
        ['aalst', 'brussels', 'river'],
        ['harrow', 'wycombe', 'land'],
        ['harrow', 'windsor', 'river'],
        ['henley', 'abingdon', 'land'],
        ['henley', 'windsor', 'land'],
        ['henley', 'oxford', 'river'],
        ['reading', 'windsor', 'river'],
        ['abingdon', 'oxford', 'river'],
        ['azia', 'nnewi', 'river'],
        ['amaigbo', 'nnewi', 'river'],
        ['igbo_ukwu', 'nnewi', 'river'],
        ['nnewi', 'ozoro', 'river'],
        ['ado_ekiti', 'ikere', 'river'],
        ['ado_ekiti', 'ilesa', 'river'],
        ['ado_ekiti', 'oshogbo', 'river'],
        ['ado_ekiti', 'oke_ila', 'land'],
        ['alexandria', 'arabs_gulf', 'port-river']
    ]

def parse_arguments():
    """Parse command line arguments."""
    if len(sys.argv) < 2:
        print("Usage: python create-adjacency-data.py <version> [--game-data-path <path>] [--no-cache]")
        print("Example: python create-adjacency-data.py 1.0.11")
        print("         python create-adjacency-data.py 1.0.11 --game-data-path /custom/path/to/game_data")
        print("         python create-adjacency-data.py 1.0.11 --no-cache")
        sys.exit(1)
    
    version = sys.argv[1]
    game_data_path = None
    use_cache = True
    
    # Check for optional arguments
    for i in range(2, len(sys.argv)):
        if sys.argv[i] == '--game-data-path' and i + 1 < len(sys.argv):
            game_data_path = sys.argv[i + 1]
        elif sys.argv[i] == '--no-cache':
            use_cache = False
    
    return version, game_data_path, use_cache

def rgb_to_hex(rgb):
    """Convert RGB tuple to hex string."""
    return '{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2])

def find_adjacent_colors(img_array):
    """Find all pairs of adjacent colors in the image."""
    height, width = img_array.shape[:2]
    adjacencies = set()
    
    print("Scanning for adjacent colors...")
    
    # Check horizontal adjacencies
    for y in tqdm(range(height), desc="Horizontal scan"):
        for x in range(width - 1):
            color1 = tuple(img_array[y, x])
            color2 = tuple(img_array[y, x + 1])
            if color1 != color2:
                adjacencies.add((color1, color2))
                adjacencies.add((color2, color1))
    
    # Check vertical adjacencies
    for y in tqdm(range(height - 1), desc="Vertical scan"):
        for x in range(width):
            color1 = tuple(img_array[y, x])
            color2 = tuple(img_array[y + 1, x])
            if color1 != color2:
                adjacencies.add((color1, color2))
                adjacencies.add((color2, color1))
    
    # Remove self-adjacencies (shouldn't happen, but just in case)
    adjacencies = {(c1, c2) for c1, c2 in adjacencies if c1 != c2}
    
    print(f"Found {len(adjacencies) // 2} unique adjacency pairs")
    
    return adjacencies

def get_region_pixels(img_array, color):
    """Get all pixel coordinates for a given color."""
    mask = np.all(img_array == color, axis=-1)
    return np.argwhere(mask)

def find_river_segment_between_locations(start_pixels, end_pixels, component_mask,
                                         locations_array, rivers_array, color_to_name,
                                         loc1, loc2, height, width, max_search_pixels=100000):
    """Return whether loc1 and loc2 are connected by a river segment.

    We look for a path inside a single connected river component from any
    river pixel in loc1 to any river pixel in loc2 such that every traversed
    pixel belongs either to loc1, to loc2, or to no mapped location at all.

    In particular, if reaching loc2 would require passing through a pixel
    that belongs to some third location C, the connection is rejected.
    Whether the river runs through interior or border pixels is ignored.

    Returns (found: bool, segment_colors: set[str]) where segment_colors is
    the set of river colors seen along one such valid path.
    """
    from collections import deque

    queue = deque()
    visited = set()
    segment_colors = set()

    # Seed BFS from all start pixels that are part of this component
    for y, x in start_pixels:
        if not component_mask[y, x]:
            continue
        queue.append((y, x))
        visited.add((y, x))
        river_color = tuple(rivers_array[y, x])
        segment_colors.add(rgb_to_hex(river_color))

    pixels_explored = 0

    while queue:
        if pixels_explored > max_search_pixels:
            # Safety guard against pathological components
            return False, set()

        y, x = queue.popleft()
        pixels_explored += 1

        if (y, x) in end_pixels:
            return True, segment_colors

        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if ny < 0 or ny >= height or nx < 0 or nx >= width:
                continue
            if (ny, nx) in visited:
                continue
            if not component_mask[ny, nx]:
                # Stay strictly on the river component
                continue

            pixel_color = tuple(locations_array[ny, nx])
            pixel_location = color_to_name.get(pixel_color)

            # Disallow paths that would go through a third location C
            if pixel_location is not None and pixel_location not in {loc1, loc2}:
                continue

            visited.add((ny, nx))
            queue.append((ny, nx))

            river_color = tuple(rivers_array[ny, nx])
            segment_colors.add(rgb_to_hex(river_color))

    return False, set()

def precompute_river_locations(rivers_array, locations_array, color_to_name, cache_file=None, existing_cache=None):
    """
    Precompute which locations each river (connected component) flows through.
    
    Rivers can change color over their trajectory - all connected river pixels are considered
    part of the same river, regardless of color.
    
    Two distinct adjacent provinces A and B are connected by a river if:
    - There is a river (contiguous connected component of river pixels) that overlaps with both A and B
    - That is, if the same river component has pixels in both location A and location B
    
    Returns:
        - dict mapping (loc1, loc2) -> dict{river_id: set of colors} - River connections with their segment colors
    
    Args:
        cache_file: If provided, will incrementally save progress to this file
        existing_cache: If provided, will resume from this cached data
    """
    print("Precomputing river-to-location mappings...")
    
    # Structure: location_pair_to_rivers[(loc1, loc2)] = {river_id: set(colors)}
    # This stores both the river connection and the colors of the segment that connects them
    
    # Load existing progress if available
    if existing_cache:
        # Handle old format (set of river_ids) and new format (dict of river_id -> colors)
        location_pair_to_rivers_raw = existing_cache['location_pair_to_rivers']
        location_pair_to_rivers = defaultdict(dict)
        for key, value in location_pair_to_rivers_raw.items():
            if isinstance(value, dict):
                # New format
                location_pair_to_rivers[key] = {int(k): set(v) if isinstance(v, list) else v for k, v in value.items()}
            else:
                # Old format - convert set of river_ids to dict with empty color sets
                location_pair_to_rivers[key] = {int(river_id): set() for river_id in value}
        
        processed_components = existing_cache['processed_components']
        next_river_id = existing_cache['next_river_id']
        print(f"Resuming from cache: {len(location_pair_to_rivers)} location pairs, {len(processed_components)} components processed")
    else:
        location_pair_to_rivers = defaultdict(dict)  # Changed from defaultdict(set) to defaultdict(dict)
        processed_components = set()
        next_river_id = 0
    
    # Identify river pixels (not white 255,255,255 and not pink 255,0,128 for sea zones)
    white = np.array([255, 255, 255])
    sea_pink = np.array([255, 0, 128])  # Sea zones use this pink color
    is_river = ~(np.all(rivers_array == white, axis=-1) | np.all(rivers_array == sea_pink, axis=-1))
    
    # Find all connected components of river pixels (regardless of color)
    # Rivers can change color over their trajectory - all connected pixels are one river
    print("Finding connected river components (ignoring color changes)...")
    labeled, num_features = ndimage.label(is_river)
    print(f"Found {num_features} river components")
    
    total_to_process = num_features - len(processed_components)
    print(f"Total river components: {num_features}, Already processed: {len(processed_components)}, To process: {total_to_process}")
    
    if total_to_process == 0:
        print("All components already processed!")
        return location_pair_to_rivers
    
    height, width = locations_array.shape[:2]
    
    # Process all components with a single progress bar
    pbar = tqdm(total=total_to_process, desc="Processing river components")
    components_since_save = 0
    save_interval = 10  # Save every 10 components
    component_count = 0
    
    # Process each connected component
    for component_id in range(1, num_features + 1):
        component_mask = labeled == component_id
        
        # Generate deterministic unique ID based on component coordinates
        component_coords = np.argwhere(component_mask)
        if len(component_coords) == 0:
            continue
        
        # Sort coordinates to get deterministic ordering
        component_coords_sorted = sorted([(int(y), int(x)) for y, x in component_coords])
        min_y, min_x = component_coords_sorted[0]
        
        # Create deterministic ID based on coordinates (no color in key since we don't separate by color)
        coords_str = ','.join(f"{y},{x}" for y, x in component_coords_sorted[:1000])  # Sample for hash
        coords_hash = hashlib.md5(coords_str.encode()).hexdigest()[:8]
        component_key = f"{min_y}_{min_x}_{coords_hash}"
        
        # Skip if already processed
        if component_key in processed_components:
            continue
            
        component_count += 1
        component_size = np.sum(component_mask)
        component_start_time = time.time()
        
        # Log progress for large components
        if component_count % 100 == 0 or component_size > 10000:
            pbar.set_postfix({
                'current': f"{component_key[:20]}...",
                'size': f"{component_size}px",
                'processed': f"{component_count}/{total_to_process}"
            })
        
        # Warn if component is very large
        if component_size > 50000:
            print(f"\n⚠️  Processing very large component {component_key}: {component_size} pixels (this may take a while...)")
        
        # Find which location colors this river component goes through
        # (river pixels must be ON the location, not just touching borders)
        touched_pixels = locations_array[component_mask]
        unique_colors = np.unique(touched_pixels.reshape(-1, 3), axis=0)
        
        touched_locations = set()
        for color in unique_colors:
            loc_name = color_to_name.get(tuple(color))
            if loc_name:
                touched_locations.add(loc_name)
        
        # River colors are now stored per connection in location_pair_to_rivers
        # No need to store them separately here

        # Check for river connections: river must go from A to B without passing through C
        # Note: even if a component touches fewer than 2 locations, we still
        # mark it as processed so it won't be repeatedly counted as "to process"
        # when resuming from cache.
        if len(touched_locations) >= 2:
            # Use deterministic ID based on component coordinates
            coords_str = ','.join(f"{y},{x}" for y, x in component_coords_sorted[:1000])
            coords_hash = hashlib.md5(coords_str.encode()).hexdigest()[:8]
            river_id = int(coords_hash, 16) % (2**31)  # Convert hash to integer ID
                
            # Get all river pixel coordinates for this component
            river_pixel_coords = np.argwhere(component_mask)
            
            # For each location, find all river pixels in that location
            location_river_pixels = defaultdict(list)

            # Collect all river pixels directly in locations for this component
            for y, x in river_pixel_coords:
                pixel_color = tuple(locations_array[y, x])
                pixel_location = color_to_name.get(pixel_color)
                if pixel_location:
                    location_river_pixels[pixel_location].append((y, x))
            
            # Now check all pairs of locations
            location_list = list(touched_locations)
            for i in range(len(location_list)):
                for j in range(i + 1, len(location_list)):
                    loc1 = location_list[i]
                    loc2 = location_list[j]
                    
                    # Get all river pixels in each location
                    loc1_pixels = location_river_pixels.get(loc1, [])
                    loc2_pixels = location_river_pixels.get(loc2, [])
                    
                    # Skip if either location has no river pixels
                    if not loc1_pixels or not loc2_pixels:
                                continue
                    
                    # Check if there's a contiguous river segment from loc1 to loc2
                    # The path must only go through loc1, loc2, or unassigned pixels adjacent to them
                    start_pixels = set(loc1_pixels)
                    end_pixels = set(loc2_pixels)
                    
                    has_segment, segment_colors = find_river_segment_between_locations(
                        start_pixels, end_pixels, component_mask,
                        locations_array, rivers_array, color_to_name, loc1, loc2,
                        height, width
                    )
                    
                    if has_segment:
                        # Ensure alphabetical order
                        if loc1 > loc2:
                            loc1, loc2 = loc2, loc1
                        # Store river connection with its segment colors
                        # Structure: {river_id: set(colors)}
                        if river_id not in location_pair_to_rivers[(loc1, loc2)]:
                            location_pair_to_rivers[(loc1, loc2)][river_id] = set()
                        location_pair_to_rivers[(loc1, loc2)][river_id].update(segment_colors)

                    # No extra diagnostics or logging here: we only care
                    # whether a valid A -> B river segment exists and, if so,
                    # which river colors appear along that segment.

        # Mark this component as processed (even if it didn't connect 2 locations)
        processed_components.add(component_key)
        components_since_save += 1
        pbar.update(1)
            
        # Log time for very large components
        component_time = time.time() - component_start_time
        if component_size > 50000 or component_time > 10:
            print(f"  ✓ Completed component {component_key} in {component_time:.1f}s")
        
        # Periodically save to cache
        if cache_file and components_since_save >= save_interval:
            save_river_cache(cache_file, location_pair_to_rivers, processed_components, next_river_id)
            components_since_save = 0
    
    pbar.close()
    
    # Final save
    if cache_file:
        save_river_cache(cache_file, location_pair_to_rivers, processed_components, next_river_id)
    
    print(f"Found {len(location_pair_to_rivers)} location pairs with river connections")
    
    return location_pair_to_rivers

def save_river_cache(cache_file, location_pair_to_rivers, processed_components, next_river_id):
    """Save river computation results and progress to cache file."""
    # Convert dict values to serializable format: {river_id: set(colors)} -> {river_id: list(colors)}
    serializable_data = {
        'location_pair_to_rivers': {
            f"{loc1}|{loc2}": {
                str(river_id): list(colors) 
                for river_id, colors in rivers_dict.items()
            }
            for (loc1, loc2), rivers_dict in location_pair_to_rivers.items()
        },
        'processed_components': list(processed_components),
        'next_river_id': next_river_id
        }
    
    cache_dir = Path(cache_file).parent
    cache_dir.mkdir(exist_ok=True)
    
    # Write to temporary file first, then rename (atomic operation)
    temp_file = cache_file + '.tmp'
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(serializable_data, f, indent=2)
    
    os.replace(temp_file, cache_file)

def load_river_cache(cache_file):
    """Load river computation results and progress from cache file."""
    print(f"Loading river cache from {cache_file}...")
    
    with open(cache_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle old cache format (just location_pair_to_rivers as set)
    if isinstance(data, dict) and 'location_pair_to_rivers' not in data:
        # Old format - treat as complete, convert to new format
        location_pair_to_rivers = defaultdict(dict)
        for key, rivers in data.items():
            loc1, loc2 = key.split('|', 1)
            # Convert old format (set/list of river_ids) to new format (dict of river_id -> empty colors)
            if isinstance(rivers, (list, set)):
                location_pair_to_rivers[(loc1, loc2)] = {int(river_id): set() for river_id in rivers}
            else:
                location_pair_to_rivers[(loc1, loc2)] = {int(river_id): set() for river_id in [rivers]}
        print(f"Loaded {len(location_pair_to_rivers)} location pairs from legacy cache (treating as complete)")
        return {
            'location_pair_to_rivers': location_pair_to_rivers,
            'processed_components': set(),  # Will cause full reprocessing
            'next_river_id': 0
        }
    
    # New format with progress tracking
    location_pair_to_rivers = defaultdict(dict)
    for key, rivers_data in data['location_pair_to_rivers'].items():
        loc1, loc2 = key.split('|', 1)
        if isinstance(rivers_data, dict):
            # New format: {river_id: list(colors)}
            location_pair_to_rivers[(loc1, loc2)] = {
                int(river_id): set(colors) if isinstance(colors, list) else colors
                for river_id, colors in rivers_data.items()
            }
        else:
            # Old format: list of river_ids, convert to new format
            location_pair_to_rivers[(loc1, loc2)] = {int(river_id): set() for river_id in rivers_data}
    
    processed_components = set(data['processed_components'])
    next_river_id = data['next_river_id']
    
    print(f"Loaded {len(location_pair_to_rivers)} location pairs, {len(processed_components)} processed components from cache")
    
    return {
        'location_pair_to_rivers': location_pair_to_rivers,
        'processed_components': processed_components,
        'next_river_id': next_river_id
    }

def determine_access_type(loc1, loc2, sea_zones, lakes,
                          location_pair_to_rivers,
                          port_mappings):
    """Determine the type of access between two locations."""
    
    loc1_is_sea = loc1 in sea_zones
    loc2_is_sea = loc2 in sea_zones
    loc1_is_lake = loc1 in lakes
    loc2_is_lake = loc2 in lakes
    
    # Sea-to-sea adjacency
    if loc1_is_sea and loc2_is_sea:
        return 'sea'
    
    # Land-to-lake adjacency
    if (not loc1_is_sea and loc2_is_lake) or (loc1_is_lake and not loc2_is_sea):
        return 'lake'
    
    # Land-to-sea adjacency (port or coastal connection)
    if (loc1_is_sea and not loc2_is_sea and not loc2_is_lake) or \
       (loc2_is_sea and not loc1_is_sea and not loc1_is_lake):
        # Identify land and sea endpoints
        if loc1_is_sea:
            sea_loc, land_loc = loc1, loc2
        else:
            sea_loc, land_loc = loc2, loc1

        pair_key = (loc1, loc2) if loc1 < loc2 else (loc2, loc1)

        # Ports file defines which land provinces actually have a harbor
        # connection to which sea zones. Only those pairs should be treated
        # as real ports; otherwise we fall back to a generic 'coastal' edge.
        has_port = (land_loc, sea_loc) in port_mappings

        if pair_key in location_pair_to_rivers and location_pair_to_rivers[pair_key]:
            # If there's a river connection as well, distinguish true river
            # ports from generic coastal river mouths.
            # TODO: This really wants 'river' as a boolean attribute on the
            #       edge rather than being encoded in the edge type. This
            #       should be refactored later so ports and rivers are
            #       orthogonal flags instead of combined strings.
            return 'port-river' if has_port else 'coastal'

        return 'port' if has_port else 'coastal'
    
    # Land-to-land adjacency
    if not loc1_is_sea and not loc1_is_lake and not loc2_is_sea and not loc2_is_lake:
        # Check for river connection using precomputed mapping
        pair_key = (loc1, loc2) if loc1 < loc2 else (loc2, loc1)
        if pair_key in location_pair_to_rivers and location_pair_to_rivers[pair_key]:
            return 'river'
        
        return 'land'
    
    return None

def derive_location_to_river_colors(location_pair_to_rivers):
    """
    Derive location_to_river_colors from location_pair_to_rivers.
    This aggregates all river colors for each location from all its connections.
    """
    location_to_river_colors = defaultdict(set)
    for (loc1, loc2), rivers_dict in location_pair_to_rivers.items():
        for river_id, colors in rivers_dict.items():
            location_to_river_colors[loc1].update(colors)
            location_to_river_colors[loc2].update(colors)
    return location_to_river_colors


def validate_expected_results_in_csv(expected_results_list, adjacency_csv_path):
    """Validate that all expected_results entries exist in the generated CSV.

    expected_results_list: iterable of (locA, locB, accessType)
    adjacency_csv_path: path to adjacency-data.csv to validate against
    """
    if not expected_results_list:
        # Nothing to validate
        return

    print("\nValidating expected adjacency results against generated CSV...")

    # Load CSV into a lookup map
    adjacency_map = {}
    try:
        with open(adjacency_csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader, None)

            # Support both 3- and 4-column schemas by name
            header_idx = {name: idx for idx, name in enumerate(header)} if header else {}
            locA_idx = header_idx.get('locationA', 0)
            locB_idx = header_idx.get('locationB', 1)
            type_idx = header_idx.get('accessType', 2)

            for row in reader:
                if not row or len(row) <= max(locA_idx, locB_idx, type_idx):
                    continue
                a = row[locA_idx].strip()
                b = row[locB_idx].strip()
                t = row[type_idx].strip()
                if not a or not b:
                    continue
                adjacency_map[(a, b)] = t
    except FileNotFoundError as e:
        raise FileNotFoundError(
            f"Adjacency CSV not found for validation: {adjacency_csv_path}"
        ) from e

    mismatches = []

    for locA, locB, expected_type in expected_results_list:
        # Normalize order to match CSV convention
        a, b = (locA, locB) if locA <= locB else (locB, locA)
        actual_type = adjacency_map.get((a, b))

        if actual_type is None:
            mismatches.append(
                f"Missing expected adjacency: ({a}, {b}) with type '{expected_type}'"
            )
        elif actual_type != expected_type:
            mismatches.append(
                f"Type mismatch for ({a}, {b}): expected '{expected_type}', got '{actual_type}'"
            )

    if mismatches:
        print("Expected results validation FAILED:")
        for msg in mismatches:
            print("  - " + msg)
        print(f"Total mismatches: {len(mismatches)}")
        # Fail the script explicitly so this is caught in pipelines
        sys.exit(1)

    print("Expected results validation passed: all expected adjacencies found with correct types.")

def main():
    start_time = time.time()
    version, game_data_path, use_cache = parse_arguments()
    
    print(f"Loading game data for version {version}...")
    if game_data_path:
        print(f"Using custom game data path: {game_data_path}")
    
    # Load file paths using GameDataLoader
    try:
        loader = GameDataLoader(folder_path=game_data_path)
        game_files = loader.get_game_files_for_version(version)
        print(f"✓ Found game files:")
        print(f"  - Locations map: {game_files.locations_map}")
        print(f"  - Rivers map: {game_files.rivers_map}")
        print(f"  - Color mapping: {game_files.locations_color_mapping}")
        print(f"  - Default map: {game_files.location_classification}")
        print(f"  - Ports file: {game_files.ports_file}")
        print(f"  - Special adjacency file: {game_files.special_adjacency_file}")
        print(f"  - River classification file: {game_files.computed_river_classification_file}")
        print(f"  - Special adjacency file: {game_files.special_adjacency_file}")
    except (FileNotFoundError, ValueError) as e:
        print(f"Error loading game data: {e}")
        sys.exit(1)
    
    print("\nLoading images...")
    locations_img = Image.open(game_files.locations_map).convert('RGB')
    rivers_img = Image.open(game_files.rivers_map).convert('RGB')
    
    locations_array = np.array(locations_img)
    rivers_array = np.array(rivers_img)
    
    print("Loading color mapping...")
    color_to_name, name_to_color = load_color_to_name_mapping(game_files.locations_color_mapping)
    print(f"Loaded {len(color_to_name)} location mappings")
    
    print("Parsing default.map...")
    sea_zones, lakes = parse_default_map(game_files.location_classification)
    print(f"Found {len(sea_zones)} sea zones and {len(lakes)} lakes")

    print("Loading ports file...")
    port_mappings = set()
    try:
        with open(game_files.ports_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter=';')
            header = next(reader, None)
            # Expect columns: LandProvince;SeaZone;...
            for row in reader:
                if not row or len(row) < 2:
                    continue
                land = row[0].strip()
                sea = row[1].strip()
                if not land or not sea:
                    continue
                port_mappings.add((land, sea))
    except FileNotFoundError:
        print("  ⚠️  Ports file not found; all land–sea edges will be treated as generic 'coastal' (or base port logic)")
    
    print("Parsing location templates...")
    location_data = parse_location_templates(game_files.location_data)
    print(f"Loaded data for {len(location_data)} locations")
    
    # Identify wasteland locations
    wasteland_locations = {name for name, data in location_data.items() 
                          if data.topography and 'wasteland' in data.topography}
    print(f"Found {len(wasteland_locations)} wasteland locations to exclude")
    
    # Check for cached river computation
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cache_file = os.path.join(script_dir, 'tmp', f'river_cache_{version}.json')
    
    existing_cache = None
    if use_cache and os.path.exists(cache_file):
        print(f"\n✓ Found cached river data")
        existing_cache = load_river_cache(cache_file)
        
        # Check if cache is complete
        if existing_cache['processed_components']:
            print("Cache contains partial progress, will resume computation...")
    elif not use_cache:
        print("\nSkipping cache (--no-cache flag)")
    
    # Compute or resume river connections
    location_pair_to_rivers = precompute_river_locations(
        rivers_array, locations_array, color_to_name,
        cache_file=cache_file if use_cache else None,
        existing_cache=existing_cache
    )
    
    # Derive location_to_river_colors from location_pair_to_rivers for JSON output
    location_to_river_colors = derive_location_to_river_colors(location_pair_to_rivers)
    
    print("\nFinding adjacent regions...")
    adjacencies = find_adjacent_colors(locations_array)
    
    print("\nProcessing adjacencies...")
    # Map (loc1, loc2) -> (access_type, through_location)
    results_map = {}
    processed = set()
    
    for color1, color2 in tqdm(adjacencies, desc="Processing adjacency pairs"):
        # Get location names
        loc1 = color_to_name.get(color1)
        loc2 = color_to_name.get(color2)
        
        if not loc1 or not loc2:
            continue
        
        # Skip if either location is wasteland
        if loc1 in wasteland_locations or loc2 in wasteland_locations:
            continue
        
        # Ensure alphabetical order and avoid duplicates
        if loc1 > loc2:
            loc1, loc2 = loc2, loc1
        
        pair = (loc1, loc2)
        if pair in processed:
            continue
        
        processed.add(pair)
        
        # Determine access type
        access_type = determine_access_type(
            loc1, loc2, sea_zones, lakes,
            location_pair_to_rivers,
            port_mappings
        )
        
        if access_type:
            # Regular adjacencies have no through-location information
            results_map[(loc1, loc2)] = (access_type, "")

    # Load special adjacencies (through-sea edges)
    print("\nLoading special adjacencies...")
    try:
        with open(game_files.special_adjacency_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f, delimiter=';')
            header = next(reader, None)
            for row in reader:
                if not row or len(row) < 4:
                    continue
                from_loc = row[0].strip()
                to_loc = row[1].strip()
                through_loc = row[3].strip()

                if not from_loc or not to_loc:
                    continue

                # Normalize order to keep the graph undirected and consistent
                loc1, loc2 = sorted([from_loc, to_loc])

                # Each special adjacency becomes a through-sea edge
                results_map[(loc1, loc2)] = ("through-sea", through_loc)
    except FileNotFoundError:
        print("  No special adjacency file found; skipping")

    # Snapshot state before applying river classification refinement
    def count_by_type_from_map(m):
        counts = defaultdict(int)
        for (_, _), (access_type, _) in m.items():
            counts[access_type] += 1
        return counts

    # Make a shallow copy so we can inspect "before" adjacencies later
    results_map_before = dict(results_map)
    access_type_counts_before = count_by_type_from_map(results_map_before)

    # Apply river classification refinement
    print("\nApplying river classification refinements...")

    # First, build a map from each location to the set of neighbors that
    # river_layer_classification marks as river-accessible ("good result").
    classification_neighbors_by_location = defaultdict(set)

    try:
        with open(game_files.computed_river_classification_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or len(row) < 3:
                    continue
                location_a = row[0].strip()
                assessment = row[1].strip().lower()
                if assessment != 'good result':
                    continue
                neighbors_str = row[2].strip()
                if not neighbors_str:
                    continue

                neighbors_list = [n.strip() for n in neighbors_str.split('|') if n.strip()]
                if not neighbors_list:
                    continue

                classification_neighbors_by_location[location_a].update(neighbors_list)
    except FileNotFoundError as e:
        raise FileNotFoundError(
            f"River classification file not found: {game_files.computed_river_classification_file}"
        ) from e

    # Now, for each adjacency pair, look at the union of A's and B's
    # classification neighbor lists. If B is in A's list or A is in B's list,
    # the edge should be river/port-river (depending on whether the base type
    # is land or port). If at least one side has a good-result line but the
    # other location is not in the union, the edge should be demoted back to
    # land/port. Pairs for which neither endpoint has a good-result line are
    # left unchanged.
    for (loc1, loc2), (current_type, through_loc) in list(results_map.items()):
        base_type, _base_through = results_map_before.get((loc1, loc2), (current_type, through_loc))

        # Do not touch non land/port types (sea, lake, through-sea, etc.).
        if base_type not in ('land', 'river', 'port', 'port-river'):
            continue

        neighbors1 = classification_neighbors_by_location.get(loc1, set())
        neighbors2 = classification_neighbors_by_location.get(loc2, set())

        # If neither side has a 'good result' line, leave the base type alone.
        if not neighbors1 and not neighbors2:
            continue

        in_union = (loc2 in neighbors1) or (loc1 in neighbors2)

        if base_type in ('land', 'river'):
            new_type = 'river' if in_union else 'land'
        elif base_type in ('port', 'port-river'):
            new_type = 'port-river' if in_union else 'port'
        else:
            new_type = current_type

        if new_type != current_type:
            results_map[(loc1, loc2)] = (new_type, through_loc)

    access_type_counts_after = count_by_type_from_map(results_map)

    # Convert map to sorted list of records
    results = [
        (loc1, loc2, access_type, through_loc)
        for (loc1, loc2), (access_type, through_loc) in results_map.items()
    ]

    print(f"\nGenerated {len(results)} adjacency records (including special adjacencies and river refinements)")
    
    # Sort results alphabetically
    results.sort()


    # Create output directories under game_data
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    adjacency_dir = os.path.join(project_root, 'game_data', 'computed_adjacency_data', version)
    river_colors_dir = os.path.join(project_root, 'game_data', 'computed_river_colors', version)
    os.makedirs(adjacency_dir, exist_ok=True)
    os.makedirs(river_colors_dir, exist_ok=True)
    
    # Write output CSV
    output_file = os.path.join(adjacency_dir, 'adjacency-data.csv')
    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # Extra 'through_location' column is used only for through-sea edges
        writer.writerow(['locationA', 'locationB', 'accessType', 'through_location'])
        writer.writerows(results)
    
    # Write location-to-river-colors mapping
    # Derive from location_pair_to_rivers (aggregate all colors for each location)
    river_colors_output = os.path.join(river_colors_dir, 'location-river-colors.json')
    print(f"\nWriting location-river-colors mapping to {river_colors_output}...")
    
    # Derive location_to_river_colors from location_pair_to_rivers
    location_to_river_colors = derive_location_to_river_colors(location_pair_to_rivers)
    
    # Convert defaultdict to regular dict and sets to lists for JSON serialization
    river_colors_data = {
        loc: list(colors) 
        for loc, colors in sorted(location_to_river_colors.items())
    }
    
    with open(river_colors_output, 'w', encoding='utf-8') as f:
        json.dump(river_colors_data, f, indent=2)
    
    print(f"✓ Wrote {len(river_colors_data)} locations with river data")

    # Write river classification application log
    log_file = os.path.join(adjacency_dir, 'apply_river_classification_logs.txt')
    print(f"\nWriting river classification log to {log_file}...")

    # Helper to get per-location adjacency snapshot
    def get_location_adjacencies(results_map_snapshot, location):
        adjacencies = []
        for (loc1, loc2), (access_type, through_loc) in results_map_snapshot.items():
            if loc1 == location or loc2 == location:
                other = loc2 if loc1 == location else loc1
                adjacencies.append((location, other, access_type, through_loc))
        # Sort for deterministic output
        adjacencies.sort(key=lambda x: (x[1], x[2], x[3]))
        return adjacencies

    focus_locations = ["ath", "brussels", "aalst", "oudenaarde", "antwerp"]

    with open(log_file, 'w', encoding='utf-8') as lf:
        lf.write("River classification application log\n")
        lf.write(f"Version: {version}\n")
        lf.write("\nEdge type counts before refinement:\n")
        for t, c in sorted(access_type_counts_before.items()):
            lf.write(f"  {t}: {c}\n")

        lf.write("\nEdge type counts after refinement:\n")
        for t, c in sorted(access_type_counts_after.items()):
            lf.write(f"  {t}: {c}\n")

        lf.write("\nDetailed adjacency changes for focus locations (before vs after):\n")

        for loc in focus_locations:
            lf.write(f"\n=== Location: {loc} ===\n")
            before_adjs = get_location_adjacencies(results_map_before, loc)
            after_adjs = get_location_adjacencies(results_map, loc)

            lf.write("Before:\n")
            if not before_adjs:
                lf.write("  (no adjacencies)\n")
            else:
                for a_loc, b_loc, a_type, a_through in before_adjs:
                    lf.write(
                        f"  {a_loc} -> {b_loc}: {a_type}"
                        + (f" (through {a_through})" if a_through else "")
                        + "\n"
                    )

            lf.write("After:\n")
            if not after_adjs:
                lf.write("  (no adjacencies)\n")
            else:
                for a_loc, b_loc, a_type, a_through in after_adjs:
                    lf.write(
                        f"  {a_loc} -> {b_loc}: {a_type}"
                        + (f" (through {a_through})" if a_through else "")
                        + "\n"
                    )

    print("Done!")

    # Final validation step against expected_results
    validate_expected_results_in_csv(expected_results, output_file)
    
    # Print total execution time
    elapsed_time = time.time() - start_time
    minutes = int(elapsed_time // 60)
    seconds = int(elapsed_time % 60)
    print(f"\nTotal execution time: {minutes}m {seconds}s")

if __name__ == '__main__':
    main()
