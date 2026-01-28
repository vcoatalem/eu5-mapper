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
from pathlib import Path
from PIL import Image
import numpy as np
from collections import defaultdict
from scipy import ndimage
from tqdm import tqdm
from game_data_loader import GameDataLoader
from game_data_utils import load_color_to_name_mapping, parse_default_map, parse_location_templates

def parse_arguments():
    """Parse command line arguments."""
    if len(sys.argv) < 2:
        print("Usage: python create-adjacency-data.py <version> [--game-data-path <path>] [--no-cache]")
        print("Example: python create-adjacency-data.py 0.0.11")
        print("         python create-adjacency-data.py 0.0.11 --game-data-path /custom/path/to/game_data")
        print("         python create-adjacency-data.py 0.0.11 --no-cache")
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

def precompute_river_locations(rivers_array, locations_array, color_to_name, cache_file=None, existing_cache=None):
    """
    Precompute which locations each river (connected component) flows through.
    Returns:
        - dict mapping (loc1, loc2) -> set of river_ids
        - dict mapping location_name -> set of river hex colors
    
    Args:
        cache_file: If provided, will incrementally save progress to this file
        existing_cache: If provided, will resume from this cached data
    """
    print("Precomputing river-to-location mappings...")
    
    from scipy.ndimage import binary_dilation
    
    # Load existing progress if available
    if existing_cache:
        location_pair_to_rivers = existing_cache['location_pair_to_rivers']
        processed_components = existing_cache['processed_components']
        next_river_id = existing_cache['next_river_id']
        location_to_river_colors = existing_cache.get('location_to_river_colors', defaultdict(set))
        print(f"Resuming from cache: {len(location_pair_to_rivers)} location pairs, {len(processed_components)} components processed")
    else:
        location_pair_to_rivers = defaultdict(set)
        processed_components = set()
        next_river_id = 0
        location_to_river_colors = defaultdict(set)
    
    # Identify river pixels (not white 255,255,255 and not pink 255,0,255)
    white = np.array([255, 255, 255])
    pink = np.array([255, 0, 255])
    is_river = ~(np.all(rivers_array == white, axis=-1) | np.all(rivers_array == pink, axis=-1))
    
    # Get all unique river colors
    print("Scanning for unique river colors...")
    river_coords = np.argwhere(is_river)
    unique_river_colors = set()
    for y, x in tqdm(river_coords, desc="Scanning river pixels"):
        unique_river_colors.add(tuple(rivers_array[y, x]))
    
    print(f"Found {len(unique_river_colors)} unique river colors")
    
    # Count total components first for better progress tracking
    total_components = 0
    river_color_components = []
    
    print("Analyzing river structure...")
    for river_color in tqdm(unique_river_colors, desc="Labeling river components"):
        river_color_mask = np.all(rivers_array == river_color, axis=-1)
        labeled, num_features = ndimage.label(river_color_mask)
        river_color_components.append((river_color, labeled, num_features))
        total_components += num_features
    
    total_to_process = total_components - len(processed_components)
    print(f"Total river components: {total_components}, Already processed: {len(processed_components)}, To process: {total_to_process}")
    
    if total_to_process == 0:
        print("All components already processed!")
        return location_pair_to_rivers, location_to_river_colors
    
    # Process all components with a single progress bar
    pbar = tqdm(total=total_to_process, desc="Processing river components")
    components_since_save = 0
    save_interval = 10  # Save every 10 components
    
    for river_color, labeled, num_features in river_color_components:
        river_color_hex = rgb_to_hex(river_color)
        
        # For each connected component of this color
        for component_id in range(1, num_features + 1):
            component_key = f"{river_color_hex}_{component_id}"
            
            # Skip if already processed
            if component_key in processed_components:
                continue
            
            component_mask = labeled == component_id
            
            # Find which location colors this river component goes through
            # (river pixels must be ON the location, not just touching borders)
            touched_pixels = locations_array[component_mask]
            unique_colors = np.unique(touched_pixels.reshape(-1, 3), axis=0)
            
            touched_locations = set()
            for color in unique_colors:
                loc_name = color_to_name.get(tuple(color))
                if loc_name:
                    touched_locations.add(loc_name)
            
            # Store river color for each location it touches (even single locations)
            for loc_name in touched_locations:
                location_to_river_colors[loc_name].add(river_color_hex)
            
            # Only store rivers that touch at least 2 locations
            if len(touched_locations) >= 2:
                river_id = next_river_id
                next_river_id += 1
                
                # Add to location pair mapping
                locations_list = list(touched_locations)
                for i in range(len(locations_list)):
                    for j in range(i + 1, len(locations_list)):
                        loc1, loc2 = locations_list[i], locations_list[j]
                        if loc1 > loc2:
                            loc1, loc2 = loc2, loc1
                        location_pair_to_rivers[(loc1, loc2)].add(river_id)
            
            # Mark as processed
            processed_components.add(component_key)
            components_since_save += 1
            pbar.update(1)
            
            # Periodically save to cache
            if cache_file and components_since_save >= save_interval:
                save_river_cache(cache_file, location_pair_to_rivers, processed_components, next_river_id, location_to_river_colors)
                components_since_save = 0
    
    pbar.close()
    
    # Final save
    if cache_file:
        save_river_cache(cache_file, location_pair_to_rivers, processed_components, next_river_id, location_to_river_colors)
    
    print(f"Found {len(location_pair_to_rivers)} location pairs with river connections")
    print(f"Found {len(location_to_river_colors)} locations with rivers")
    
    return location_pair_to_rivers, location_to_river_colors

def save_river_cache(cache_file, location_pair_to_rivers, processed_components, next_river_id, location_to_river_colors=None):
    """Save river computation results and progress to cache file."""
    # Convert set values to lists for JSON serialization
    serializable_data = {
        'location_pair_to_rivers': {
            f"{loc1}|{loc2}": list(rivers) 
            for (loc1, loc2), rivers in location_pair_to_rivers.items()
        },
        'processed_components': list(processed_components),
        'next_river_id': next_river_id
    }
    
    if location_to_river_colors:
        serializable_data['location_to_river_colors'] = {
            loc: list(colors) 
            for loc, colors in location_to_river_colors.items()
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
    
    # Handle old cache format (just location_pair_to_rivers)
    if isinstance(data, dict) and 'location_pair_to_rivers' not in data:
        # Old format - treat as complete
        location_pair_to_rivers = defaultdict(set)
        for key, rivers in data.items():
            loc1, loc2 = key.split('|', 1)
            location_pair_to_rivers[(loc1, loc2)] = set(rivers)
        print(f"Loaded {len(location_pair_to_rivers)} location pairs from legacy cache (treating as complete)")
        return {
            'location_pair_to_rivers': location_pair_to_rivers,
            'processed_components': set(),  # Will cause full reprocessing
            'next_river_id': 0
        }
    
    # New format with progress tracking
    location_pair_to_rivers = defaultdict(set)
    for key, rivers in data['location_pair_to_rivers'].items():
        loc1, loc2 = key.split('|', 1)
        location_pair_to_rivers[(loc1, loc2)] = set(rivers)
    
    processed_components = set(data['processed_components'])
    next_river_id = data['next_river_id']
    
    # Load location_to_river_colors if available
    location_to_river_colors = defaultdict(set)
    if 'location_to_river_colors' in data:
        for loc, colors in data['location_to_river_colors'].items():
            location_to_river_colors[loc] = set(colors)
    
    print(f"Loaded {len(location_pair_to_rivers)} location pairs, {len(processed_components)} processed components from cache")
    
    return {
        'location_pair_to_rivers': location_pair_to_rivers,
        'processed_components': processed_components,
        'next_river_id': next_river_id,
        'location_to_river_colors': location_to_river_colors
    }

def determine_access_type(loc1, loc2, sea_zones, lakes, 
                          location_pair_to_rivers):
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
    
    # Land-to-sea adjacency (automatically creates port connection)
    if (loc1_is_sea and not loc2_is_sea and not loc2_is_lake) or \
       (loc2_is_sea and not loc1_is_sea and not loc1_is_lake):
        return 'port'
    
    # Land-to-land adjacency
    if not loc1_is_sea and not loc1_is_lake and not loc2_is_sea and not loc2_is_lake:
        # Check for river connection using precomputed mapping
        if (loc1, loc2) in location_pair_to_rivers:
            return 'river'
        
        return 'land'
    
    return None

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
        print(f"  - Color mapping: {game_files.color_mapping}")
        print(f"  - Default map: {game_files.default_map}")
        print(f"  - Ports file: {game_files.ports_file}")
    except (FileNotFoundError, ValueError) as e:
        print(f"Error loading game data: {e}")
        sys.exit(1)
    
    print("\nLoading images...")
    locations_img = Image.open(game_files.locations_map).convert('RGB')
    rivers_img = Image.open(game_files.rivers_map).convert('RGB')
    
    locations_array = np.array(locations_img)
    rivers_array = np.array(rivers_img)
    
    print("Loading color mapping...")
    color_to_name, name_to_color = load_color_to_name_mapping(game_files.color_mapping)
    print(f"Loaded {len(color_to_name)} location mappings")
    
    print("Parsing default.map...")
    sea_zones, lakes = parse_default_map(game_files.default_map)
    print(f"Found {len(sea_zones)} sea zones and {len(lakes)} lakes")
    
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
    location_pair_to_rivers, location_to_river_colors = precompute_river_locations(
        rivers_array, locations_array, color_to_name,
        cache_file=cache_file if use_cache else None,
        existing_cache=existing_cache
    )
    
    print("\nFinding adjacent regions...")
    adjacencies = find_adjacent_colors(locations_array)
    
    print("\nProcessing adjacencies...")
    results = []
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
            location_pair_to_rivers
        )
        
        if access_type:
            results.append((loc1, loc2, access_type))
    
    print(f"\nGenerated {len(results)} adjacency records")
    
    # Sort results alphabetically
    results.sort()


    # Create output directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, 'output', version)
    os.makedirs(output_dir, exist_ok=True)
    
    # Write output CSV
    output_file = os.path.join(output_dir, 'adjacency-data.csv')
    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['locationA', 'locationB', 'accessType'])
        writer.writerows(results)
    
    # Write location-to-river-colors mapping
    river_colors_output = os.path.join(output_dir, 'location-river-colors.json')
    print(f"\nWriting location-river-colors mapping to {river_colors_output}...")
    
    # Convert defaultdict to regular dict and sets to lists for JSON serialization
    river_colors_data = {
        loc: list(colors) 
        for loc, colors in sorted(location_to_river_colors.items())
    }
    
    with open(river_colors_output, 'w', encoding='utf-8') as f:
        json.dump(river_colors_data, f, indent=2)
    
    print(f"✓ Wrote {len(river_colors_data)} locations with river data")
    
    print("Done!")
    
    # Print summary
    access_type_counts = defaultdict(int)
    for _, _, access_type in results:
        access_type_counts[access_type] += 1
    
    print("\nSummary by access type:")
    for access_type, count in sorted(access_type_counts.items()):
        print(f"  {access_type}: {count}")
    
    # Print total execution time
    elapsed_time = time.time() - start_time
    minutes = int(elapsed_time // 60)
    seconds = int(elapsed_time % 60)
    print(f"\nTotal execution time: {minutes}m {seconds}s")

if __name__ == '__main__':
    main()
