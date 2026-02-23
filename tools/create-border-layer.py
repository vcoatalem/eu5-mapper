#!/usr/bin/env python3
"""
Generate a transparent RGBA image with borders between regions.

Usage:
  python3 create-border-layer.py <version> [--game-data-path <path>] [--output <file>]

Example:
  python3 create-border-layer.py 1.0.11
  python3 create-border-layer.py 1.0.11 --output custom_borders.png
"""

import os
import sys
import numpy as np
from PIL import Image
from game_data_loader import GameDataLoader

# Border color - consistent with terrain layer
BORDER_COLOR = (106, 106, 106, 255)  # Grey borders


def parse_arguments():
    """Parse command line arguments."""
    if len(sys.argv) < 2:
        print("Usage: python create-border-layer.py <version> [--game-data-path <path>] [--output <file>]")
        print("Example: python create-border-layer.py 1.0.11")
        print("         python create-border-layer.py 1.0.11 --output custom_borders.png")
        sys.exit(1)
    
    version = sys.argv[1]
    game_data_path = None
    output_file = None  # Will be set to default later
    
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
    
    return version, game_data_path, output_file


def main():
    version, game_data_path, output_file = parse_arguments()
    
    # Set default output directory if not specified
    if output_file is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.join(script_dir, 'output', version)
        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, 'border_layer.png')
    
    print(f"Loading game data for version {version}...")
    if game_data_path:
        print(f"Using custom game data path: {game_data_path}")
    
    # Load file paths using GameDataLoader
    try:
        loader = GameDataLoader(folder_path=game_data_path)
        game_files = loader.get_game_files_for_version(version)
        print(f"✓ Found locations map: {game_files.locations_map}")
    except (FileNotFoundError, ValueError) as e:
        print(f"Error loading game data: {e}")
        sys.exit(1)
    
    print("\nLoading locations image...")
    img = Image.open(game_files.locations_map).convert('RGB')
    img_array = np.array(img)
    height, width = img_array.shape[:2]
    print(f"Image size: {width}x{height}")
    
    print(f"Border color: RGB{BORDER_COLOR[:3]}")
    
    # Convert RGB to single integer for easier comparison
    print("Converting image data...")
    color_ints = (img_array[:,:,0].astype(np.uint32) << 16) | \
                 (img_array[:,:,1].astype(np.uint32) << 8) | \
                 img_array[:,:,2].astype(np.uint32)
    
    # Detect borders by comparing each pixel with its neighbors
    print("Detecting borders...")
    border_mask = np.zeros((height, width), dtype=bool)
    
    # Check horizontal borders (compare with right neighbor)
    border_mask[:, :-1] |= (color_ints[:, :-1] != color_ints[:, 1:])
    
    # Check vertical borders (compare with bottom neighbor)
    border_mask[:-1, :] |= (color_ints[:-1, :] != color_ints[1:, :])
    
    border_pixels = np.sum(border_mask)
    print(f"Found {border_pixels:,} border pixels")
    
    # Create output RGBA image with transparent background
    print("Creating output image...")
    output_array = np.zeros((height, width, 4), dtype=np.uint8)
    output_array[border_mask] = BORDER_COLOR
    
    print(f"Saving to {output_file}...")
    output = Image.fromarray(output_array, 'RGBA')
    output.save(output_file)
    print("Done!")


if __name__ == '__main__':
    main()
