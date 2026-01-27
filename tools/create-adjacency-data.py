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
from PIL import Image
import numpy as np
from collections import defaultdict
from scipy import ndimage
from tqdm import tqdm
from game_data_loader import GameDataLoader
from game_data_utils import load_color_to_name_mapping, parse_default_map

def parse_arguments():
    """Parse command line arguments."""
    if len(sys.argv) < 2:
        print("Usage: python create-adjacency-data.py <version> [--game-data-path <path>]")
        print("Example: python create-adjacency-data.py 0.0.11")
        print("         python create-adjacency-data.py 0.0.11 --game-data-path /custom/path/to/game_data")
        sys.exit(1)
    
    version = sys.argv[1]
    game_data_path = None
    
    # Check for optional --game-data-path override
    if len(sys.argv) >= 4 and sys.argv[2] == '--game-data-path':
        game_data_path = sys.argv[3]
    
    return version, game_data_path

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

def precompute_river_locations(rivers_array, locations_array, color_to_name):
    """
    Precompute which locations each river (connected component) flows through.
    Returns a dict mapping river_id -> set of location names
    """
    print("Precomputing river-to-location mappings...")
    
    from scipy.ndimage import binary_dilation
    
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
    
    # For each river color, find connected components and the locations they touch
    river_to_locations = {}
    river_id = 0
    
    # Count total components first for better progress tracking
    total_components = 0
    river_color_components = []
    
    print("Analyzing river structure...")
    for river_color in tqdm(unique_river_colors, desc="Labeling river components"):
        river_color_mask = np.all(rivers_array == river_color, axis=-1)
        labeled, num_features = ndimage.label(river_color_mask)
        river_color_components.append((river_color, labeled, num_features))
        total_components += num_features
    
    print(f"Total river components to process: {total_components}")
    
    # Process all components with a single progress bar
    pbar = tqdm(total=total_components, desc="Processing river components")
    
    for river_color, labeled, num_features in river_color_components:
        # For each connected component of this color
        for component_id in range(1, num_features + 1):
            component_mask = labeled == component_id
            
            # Dilate to touch adjacent regions
            structure = np.ones((3, 3))
            component_dilated = binary_dilation(component_mask, structure=structure)
            
            # Find which location colors this river component touches
            # Vectorized approach: get all colors at dilated positions
            touched_pixels = locations_array[component_dilated]
            unique_colors = np.unique(touched_pixels.reshape(-1, 3), axis=0)
            
            touched_locations = set()
            for color in unique_colors:
                loc_name = color_to_name.get(tuple(color))
                if loc_name:
                    touched_locations.add(loc_name)
            
            # Only store rivers that touch at least 2 locations
            if len(touched_locations) >= 2:
                river_to_locations[river_id] = touched_locations
                river_id += 1
            
            pbar.update(1)
    
    pbar.close()
    
    print(f"Found {len(river_to_locations)} river segments touching multiple locations")
    
    # Build reverse mapping: (loc1, loc2) -> set of rivers
    print("Building location-pair to rivers index...")
    location_pair_to_rivers = defaultdict(set)
    for river_id, locations in tqdm(river_to_locations.items(), desc="Indexing river connections"):
        locations_list = list(locations)
        # For each pair of locations touched by this river
        for i in range(len(locations_list)):
            for j in range(i + 1, len(locations_list)):
                loc1, loc2 = locations_list[i], locations_list[j]
                if loc1 > loc2:
                    loc1, loc2 = loc2, loc1
                location_pair_to_rivers[(loc1, loc2)].add(river_id)
    
    print(f"Found {len(location_pair_to_rivers)} location pairs with river connections")
    
    return location_pair_to_rivers

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
    version, game_data_path = parse_arguments()
    
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
    
    print("\nPrecomputing river connections...")
    location_pair_to_rivers = precompute_river_locations(
        rivers_array, locations_array, color_to_name
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
    
    # Write output CSV
    output_file = 'adjacency-data.csv'
    print(f"\nWriting to {output_file}...")
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['locationA', 'locationB', 'accessType'])
        writer.writerows(results)
    
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
