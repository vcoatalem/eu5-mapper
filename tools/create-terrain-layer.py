#!/usr/bin/env python3
"""
Generate an RGBA layer with rivers, water zones (seas and lakes) in blue,
and non-ownable/impassable terrain in grey on a black background.

Layering order: Black background -> Grey terrain -> Rivers -> Blue water

Uses parse_default_map to identify sea zones and lakes instead of maritime terminology matching.

Usage:
  python3 create-terrain-layer.py <version> [--game-data-path <path>] [--output <file>] [--river-map <river.png>]

Example:
  python3 create-terrain-layer.py 0.0.11
  python3 create-terrain-layer.py 0.0.11 --river-map ../game_data/river_map/0.0.11/rivers.png
  python3 create-terrain-layer.py 0.0.11 --output terrain_with_rivers.png
"""

import os
import sys
import numpy as np
from PIL import Image
from tqdm import tqdm
from game_data_loader import GameDataLoader
from game_data_utils import load_color_to_name_mapping, parse_default_map

# Colors - specific colors for each feature type
SEA_COLOR = (26, 77, 122, 255)      # Dark blue for seas
LAKE_COLOR = (91, 143, 196, 255)    # Medium blue for lakes
RIVER_COLOR = (107, 155, 209, 255)  # Light blue for rivers
BLOCKING_COLOR = (58, 58, 58, 255)  # Dark grey for blocking/non-ownable terrain



def parse_arguments():
    """Parse command line arguments."""
    if len(sys.argv) < 2:
        print("Usage: python create-terrain-layer.py <version> [--game-data-path <path>] [--output <file>]")
        print("Example: python create-terrain-layer.py 0.0.11")
        print("         python create-terrain-layer.py 0.0.11 --output terrain_with_rivers.png")
        sys.exit(1)
    
    version = sys.argv[1]
    game_data_path = None
    output_file = None  # Will be set to default later
    river_map = None
    
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--game-data-path' and i + 1 < len(sys.argv):
            game_data_path = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--output' and i + 1 < len(sys.argv):
            output_file = sys.argv[i + 1]
            i += 2
        else:
            i += 1
    
    return version, game_data_path, output_file, river_map


def parse_non_ownable_impassable(default_map_file):
    """Parse default.map file to extract non_ownable and impassable_mountains locations."""
    non_ownable = set()
    impassable = set()
    
    current = None
    with open(default_map_file, 'r', encoding='utf-8') as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            
            if line.startswith('non_ownable'):
                current = 'non_ownable'
                continue
            if line.startswith('impassable_mountains'):
                current = 'impassable_mountains'
                continue
            if line == '}':
                current = None
                continue
            
            if current in ('non_ownable', 'impassable_mountains'):
                # Tokenize on whitespace
                for token in line.split():
                    if token.startswith('#'):
                        break
                    if current == 'non_ownable':
                        non_ownable.add(token)
                    else:
                        impassable.add(token)
    
    return non_ownable, impassable


def main():
    version, game_data_path, output_file, river_map = parse_arguments()
    
    # Set default output directory if not specified
    if output_file is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, 'output', version)
        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, 'terrain_layer.png')
    
    print(f"Loading game data for version {version}...")
    if game_data_path:
        print(f"Using custom game data path: {game_data_path}")
    
    # Load file paths using GameDataLoader
    try:
        loader = GameDataLoader(folder_path=game_data_path)
        game_files = loader.get_game_files_for_version(version)
        print(f"✓ Found game files:")
        print(f"  - Locations map: {game_files.locations_map}")
        print(f"  - Color mapping: {game_files.color_mapping}")
        print(f"  - Default map: {game_files.default_map}")
        print(f"  - Rivers map: {game_files.rivers_map}")
        
        # Use rivers_map from game_files if not explicitly provided
        if river_map is None:
            river_map = game_files.rivers_map
            print(f"  Using default river map from game data")
    except (FileNotFoundError, ValueError) as e:
        print(f"Error loading game data: {e}")
        sys.exit(1)
    
    print("\nLoading locations image...")
    img = Image.open(game_files.locations_map).convert('RGB')
    img_array = np.array(img)
    height, width = img_array.shape[:2]
    print(f"Image size: {width}x{height}")
    
    print("Loading color to name mapping...")
    color_to_name, name_to_color = load_color_to_name_mapping(game_files.color_mapping)
    print(f"Loaded {len(color_to_name)} location mappings")
    
    print("Parsing default.map...")
    sea_zones, lakes = parse_default_map(game_files.default_map)
    print(f"Found {len(sea_zones)} sea zones and {len(lakes)} lakes")
    
    non_ownable, impassable = parse_non_ownable_impassable(game_files.default_map)
    print(f"Found {len(non_ownable)} non-ownable and {len(impassable)} impassable locations")
    
    # Water locations are just seas and lakes
    water_locations = sea_zones | lakes
    print(f"Total water locations: {len(water_locations)}")
    
    # Terrain locations are non-ownable and impassable, but exclude water
    terrain_locations = (non_ownable | impassable) - water_locations
    print(f"Total terrain locations (excluding water): {len(terrain_locations)}")
    
    # Create output RGBA image with transparent background
    output_array = np.zeros((height, width, 4), dtype=np.uint8)
    
    print("\nProcessing pixels...")
    # Convert image to single integer representation for faster lookup
    img_int = (img_array[:,:,0].astype(np.uint32) << 16) | \
              (img_array[:,:,1].astype(np.uint32) << 8) | \
              img_array[:,:,2].astype(np.uint32)
    
    # Build lookup lists for RGB integers - separate by type
    sea_rgb_ints = []
    lake_rgb_ints = []
    blocking_rgb_ints = []
    
    print("Building sea zones lookup...")
    for name in sea_zones:
        if name in name_to_color:
            rgb = name_to_color[name]
            if len(rgb) == 2:
                r, g = rgb
                b = 0
            else:
                r, g, b = rgb
            rgb_int = (r << 16) | (g << 8) | b
            sea_rgb_ints.append(rgb_int)
    
    print("Building lakes lookup...")
    for name in lakes:
        if name in name_to_color:
            rgb = name_to_color[name]
            if len(rgb) == 2:
                r, g = rgb
                b = 0
            else:
                r, g, b = rgb
            rgb_int = (r << 16) | (g << 8) | b
            lake_rgb_ints.append(rgb_int)
    
    print("Building blocking terrain lookup (non-ownable + impassable)...")
    # Combine non-ownable and impassable, excluding water
    blocking_terrain = terrain_locations
    for name in blocking_terrain:
        if name in name_to_color:
            rgb = name_to_color[name]
            if len(rgb) == 2:
                r, g = rgb
                b = 0
            else:
                r, g, b = rgb
            rgb_int = (r << 16) | (g << 8) | b
            blocking_rgb_ints.append(rgb_int)
    
    # Layer 1: Mark blocking terrain (non-ownable + impassable)
    print(f"\nMarking {len(blocking_rgb_ints)} blocking terrain locations...")
    blocking_mask = np.isin(img_int, blocking_rgb_ints)
    output_array[blocking_mask] = BLOCKING_COLOR
    
    # Layer 3: Add rivers (if provided)
    river_pixels = 0
    if river_map:
        print(f"\nLoading river map: {river_map}")
        try:
            river_img = Image.open(river_map).convert('RGBA')
            river_array = np.array(river_img)
            
            # Check dimensions match
            if river_array.shape[:2] != (height, width):
                print(f"Warning: River map dimensions {river_array.shape[:2]} don't match locations map {(height, width)}")
                print("Skipping river layer...")
            else:
                print("Processing river pixels...")
                # Filter out white (land) and pink (sea) pixels from river map
                rgb = river_array[:, :, :3]
                
                # White pixels (land)
                white_threshold = 245
                white_mask = (rgb >= white_threshold).all(axis=2)
                
                # Pink pixels (sea) - color (255, 0, 128) with tolerance
                pink_color = np.array([255, 0, 128], dtype=np.int16)
                pink_tolerance = 3
                diff = np.abs(rgb.astype(np.int16) - pink_color)
                pink_mask = (diff <= pink_tolerance).all(axis=2)
                
                # Black pixels (also want to filter these out)
                black_mask = (rgb <= 5).all(axis=2)
                
                # River pixels: not white, not pink, not black, and has alpha > 0
                river_mask = ~(white_mask | pink_mask | black_mask) & (river_array[:, :, 3] > 0)
                
                # Rivers go under water (don't render rivers where water will be)
                all_water_rgb_ints = sea_rgb_ints + lake_rgb_ints
                water_mask_future = np.isin(img_int, all_water_rgb_ints)
                river_final_mask = river_mask & ~water_mask_future
                
                # Apply river color (use consistent river color instead of source)
                output_array[river_final_mask] = RIVER_COLOR
                river_pixels = np.sum(river_final_mask)
                print(f"Added {river_pixels:,} river pixels")
        except FileNotFoundError:
            print(f"Warning: River map file not found: {river_map}")
            print("Continuing without river layer...")
        except Exception as e:
            print(f"Warning: Error loading river map: {e}")
            print("Continuing without river layer...")
    
    # Layer 4: Add water on top (seas and lakes with different colors)
    print(f"\nMarking {len(sea_rgb_ints)} sea zones (top layer)...")
    sea_mask = np.isin(img_int, sea_rgb_ints)
    output_array[sea_mask] = SEA_COLOR
    
    print(f"Marking {len(lake_rgb_ints)} lakes (top layer)...")
    lake_mask = np.isin(img_int, lake_rgb_ints)
    output_array[lake_mask] = LAKE_COLOR
    
    # Count pixels marked
    sea_pixels = np.sum(sea_mask)
    lake_pixels = np.sum(lake_mask)
    blocking_pixels = np.sum(blocking_mask)
    transparent_pixels = np.sum(output_array[:, :, 3] == 0)
    
    print(f"\nFinal layer composition:")
    print(f"  Transparent background: {transparent_pixels:,} pixels")
    print(f"  Blocking terrain: {blocking_pixels:,} pixels")
    print(f"  Rivers: {river_pixels:,} pixels")
    print(f"  Seas: {sea_pixels:,} pixels")
    print(f"  Lakes: {lake_pixels:,} pixels")
    
    print(f"\nSaving to {output_file}...")
    output_img = Image.fromarray(output_array, mode='RGBA')
    output_img.save(output_file)
    
    print("Done!")


if __name__ == '__main__':
    main()
