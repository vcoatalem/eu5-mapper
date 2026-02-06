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
        ['henley', 'abingdon', 'river'],
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

def hex_to_rgb(hex_str):
    """Convert hex string to RGB tuple."""
    return (int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))

def calculate_brightness(rgb):
    """Calculate brightness of an RGB color (0-255, higher = brighter)."""
    if isinstance(rgb, str):
        rgb = hex_to_rgb(rgb)
    r, g, b = rgb
    # Use standard luminance formula
    return (0.299 * r + 0.587 * g + 0.114 * b)

# Typical blue color for rivers: RGB [0, 200, 255]
TYPICAL_RIVER_BLUE_RGB = (0, 200, 255)
TYPICAL_RIVER_BLUE_HEX = rgb_to_hex(TYPICAL_RIVER_BLUE_RGB)
TYPICAL_RIVER_BLUE_BRIGHTNESS = calculate_brightness(TYPICAL_RIVER_BLUE_RGB)

# Direct connection tolerance: allows up to N consecutive pixels in a third location
# when finding river connections. For example, if a river flows A -> (5 pixels in B) -> C,
# with tolerance=5, it will create connections A↔B, A↔C, and B↔C.
# Set to 0 for strict mode (no tolerance).
DIRECT_CONNECTION_TOLERANCE = 0

# Dark river extension radius: dark rivers (darker than typical light blue) are treated as wider.
# This value specifies how many pixels away from a dark river pixel we consider as part of the river.
# For example, with radius=1, a dark river is effectively 3 pixels wide (1 center + 1 on each side).
# Set to 0 to disable the dark river width extension.
DARK_RIVER_EXTENSION_RADIUS = 1

def is_dark_river(river_color_rgb):
    """
    Check if a river color is darker than the typical baseline.
    Darker rivers are treated as wider (using DARK_RIVER_EXTENSION_RADIUS).
    
    Args:
        river_color_rgb: RGB tuple of the river color
    
    Returns:
        True if the river is darker than baseline, False otherwise
    """
    if isinstance(river_color_rgb, str):
        river_color_rgb = hex_to_rgb(river_color_rgb)
    brightness = calculate_brightness(river_color_rgb)
    return brightness < TYPICAL_RIVER_BLUE_BRIGHTNESS

def is_within_dark_river_range(y, x, river_mask, rivers_array, height, width):
    """
    Check if a pixel is within DARK_RIVER_EXTENSION_RADIUS pixels of a dark river pixel.
    This allows dark rivers to be treated as wider than normal rivers.
    
    Args:
        y, x: Pixel coordinates to check
        river_mask: Mask of river pixels (can be component_mask or is_river boolean array)
        rivers_array: Array of river colors
        height, width: Image dimensions
    
    Returns:
        True if the pixel is within DARK_RIVER_EXTENSION_RADIUS of a dark river, False otherwise
    """
    if DARK_RIVER_EXTENSION_RADIUS == 0:
        return False
    
    # Check the pixel itself
    if river_mask[y, x]:
        river_color = tuple(rivers_array[y, x])
        if is_dark_river(river_color):
            return True
    
    # Check neighbors within the extension radius
    # For radius=1, check 4-connected neighbors
    # For radius>1, would need to check all pixels within Manhattan distance
    if DARK_RIVER_EXTENSION_RADIUS >= 1:
        neighbors = [
            (y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)
        ]
        for ny, nx in neighbors:
            if ny < 0 or ny >= height or nx < 0 or nx >= width:
                continue
            if river_mask[ny, nx]:
                neighbor_river_color = tuple(rivers_array[ny, nx])
                if is_dark_river(neighbor_river_color):
                    return True
    
    # For radius > 1, check diagonal neighbors too
    if DARK_RIVER_EXTENSION_RADIUS >= 1:
        diagonal_neighbors = [
            (y - 1, x - 1), (y - 1, x + 1), (y + 1, x - 1), (y + 1, x + 1)
        ]
        for ny, nx in diagonal_neighbors:
            if ny < 0 or ny >= height or nx < 0 or nx >= width:
                continue
            if river_mask[ny, nx]:
                neighbor_river_color = tuple(rivers_array[ny, nx])
                if is_dark_river(neighbor_river_color):
                    return True
    
    return False

def analyze_river_colors(river_colors_hex_list):
    """
    Analyze river colors to determine darkness/width characteristics.
    Most rivers are light blue, darker rivers might represent wider rivers.
    
    Returns dict with:
    - colors: list of hex colors with brightness analysis
    - darkest_color: hex of darkest color
    - darkest_brightness: brightness value of darkest color
    - is_darker_than_typical: boolean indicating if darker than typical light blue
    """
    if not river_colors_hex_list:
        return {
            'colors': [],
            'darkest_color': None,
            'darkest_brightness': None,
            'is_darker_than_typical': False,
            'typical_river_blue_rgb': TYPICAL_RIVER_BLUE_RGB,
            'typical_river_blue_hex': TYPICAL_RIVER_BLUE_HEX,
            'typical_river_blue_brightness': TYPICAL_RIVER_BLUE_BRIGHTNESS
        }
    
    # Use the actual typical blue river color
    typical_light_blue_brightness = TYPICAL_RIVER_BLUE_BRIGHTNESS
    
    colors_analysis = []
    darkest_brightness = 255.0
    darkest_color = None
    
    for hex_color in river_colors_hex_list:
        rgb = hex_to_rgb(hex_color)
        brightness = calculate_brightness(rgb)
        
        colors_analysis.append({
            'hex': hex_color,
            'rgb': rgb,
            'brightness': brightness,
            'is_darker_than_typical': brightness < typical_light_blue_brightness
        })
        
        if brightness < darkest_brightness:
            darkest_brightness = brightness
            darkest_color = hex_color
    
    return {
        'colors': colors_analysis,
        'darkest_color': darkest_color,
        'darkest_brightness': darkest_brightness,
        'is_darker_than_typical': darkest_brightness < typical_light_blue_brightness if darkest_color else False,
        'typical_river_blue_rgb': TYPICAL_RIVER_BLUE_RGB,
        'typical_river_blue_hex': TYPICAL_RIVER_BLUE_HEX,
        'typical_river_blue_brightness': typical_light_blue_brightness,
        'brightness_difference': typical_light_blue_brightness - darkest_brightness if darkest_color else 0
    }

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

def is_interior_pixel(y, x, location_name, locations_array, color_to_name, height, width):
    """
    Check if a pixel is an interior pixel of a location.
    An interior pixel is one that has at least 3 out of 4 adjacent pixels of the same location.
    This is more lenient than requiring all 4 neighbors to be the same location.
    """
    # Check all 4-connected neighbors
    neighbors = [
        (y - 1, x),  # up
        (y + 1, x),  # down
        (y, x - 1),  # left
        (y, x + 1),  # right
    ]
    
    same_location_count = 0
    total_valid_neighbors = 0
    
    for ny, nx in neighbors:
        # Skip if out of bounds
        if ny < 0 or ny >= height or nx < 0 or nx >= width:
            continue
        
        total_valid_neighbors += 1
        
        # Get neighbor's location
        neighbor_color = tuple(locations_array[ny, nx])
        neighbor_location = color_to_name.get(neighbor_color)
        
        # Count neighbors with the same location
        if neighbor_location == location_name:
            same_location_count += 1
    
    # Require at least 3 out of 4 neighbors to be the same location
    # (or all valid neighbors if we're at an edge/corner)
    if total_valid_neighbors < 3:
        # At edges/corners with fewer neighbors, require all to be the same
        return same_location_count == total_valid_neighbors
    else:
        # With 3 or 4 neighbors, require at least 3 to be the same
        return same_location_count >= 3

def are_locations_adjacent_via_river(loc1, loc2, river_pixel_coords, locations_array, color_to_name, height, width):
    """
    Check if two locations are adjacent by checking if any river pixel in loc1
    has a neighbor (in the locations map) that is in loc2.
    This checks if the locations share a border near where the river flows.
    Returns True if loc1 and loc2 are adjacent, False otherwise.
    """
    # Get colors for both locations
    loc1_color = None
    loc2_color = None
    for y, x in river_pixel_coords[:100]:  # Sample first 100 pixels to find colors
        pixel_color = tuple(locations_array[y, x])
        pixel_location = color_to_name.get(pixel_color)
        if pixel_location == loc1 and loc1_color is None:
            loc1_color = pixel_color
        if pixel_location == loc2 and loc2_color is None:
            loc2_color = pixel_color
        if loc1_color and loc2_color:
            break
    
    if not loc1_color or not loc2_color:
        return False
    
    # Check if any pixel in loc1 (from river) is adjacent to loc2 in the locations map
    for y, x in river_pixel_coords:
        # Get the location at this river pixel
        pixel_color = tuple(locations_array[y, x])
        pixel_location = color_to_name.get(pixel_color)
        
        # Only check pixels in loc1
        if pixel_location != loc1:
            continue
        
        # Check all 4-connected neighbors
        neighbors = [
            (y - 1, x),  # up
            (y + 1, x),  # down
            (y, x - 1),  # left
            (y, x + 1),  # right
        ]
        
        for ny, nx in neighbors:
            # Skip if out of bounds
            if ny < 0 or ny >= height or nx < 0 or nx >= width:
                continue
            
            # Get neighbor's location
            neighbor_color = tuple(locations_array[ny, nx])
            neighbor_location = color_to_name.get(neighbor_color)
            
            # If neighbor is loc2, they are adjacent
            if neighbor_location == loc2:
                return True
    
    return False

def find_river_segment_between_locations(start_pixels, end_pixels, component_mask, 
                                         locations_array, rivers_array, color_to_name, 
                                         loc1, loc2, height, width, max_search_pixels=100000):
    """
    Use BFS to find a contiguous river segment from any pixel in loc1 to any pixel in loc2.
    The path must only go through river pixels that are in loc1 or loc2 (or unassigned pixels
    adjacent to loc1 or loc2). 
    
    Uses DIRECT_CONNECTION_TOLERANCE constant: if > 0, allows up to that many consecutive pixels
    to be in another location before the path is considered invalid. This enables connections like
    A->B->C where the river briefly passes through B.
    
    Returns:
        (found: bool, segment_colors: set) - True if path exists, and set of river hex colors along the path
    """
    from collections import deque
    
    # BFS from all start pixels simultaneously
    # Queue stores: (y, x, third_location_count)
    # third_location_count tracks consecutive pixels in a location that's not loc1 or loc2
    queue = deque()
    visited = {}  # Track visited pixels with their third_location_count
    segment_colors = set()  # Track river colors along the path
    
    # Initialize queue with all start pixels
    for pixel in start_pixels:
        queue.append((pixel[0], pixel[1], 0))  # Start with 0 third_location_count
        visited[pixel] = 0
        # Track river color at start
        if component_mask[pixel[0], pixel[1]]:
            river_color = tuple(rivers_array[pixel[0], pixel[1]])
            segment_colors.add(rgb_to_hex(river_color))
        else:
            # Pixel is near a dark river, find the dark river color
            y, x = pixel
            for nny, nnx in [(y-1, x), (y+1, x), (y, x-1), (y, x+1)]:
                if nny < 0 or nny >= height or nnx < 0 or nnx >= width:
                    continue
                if component_mask[nny, nnx]:
                    neighbor_river_color = tuple(rivers_array[nny, nnx])
                    if is_dark_river(neighbor_river_color):
                        segment_colors.add(rgb_to_hex(neighbor_river_color))
                        break
    
    pixels_explored = 0
    
    while queue:
        # Safety check: if we've explored too many pixels, this component is probably too large
        if pixels_explored > max_search_pixels:
            return False, set()
        
        y, x, third_location_count = queue.popleft()
        pixels_explored += 1
        
        # Check if we reached an end pixel
        if (y, x) in end_pixels:
            return True, segment_colors
        
        # Check all 4-connected neighbors
        neighbors = [
            (y - 1, x),  # up
            (y + 1, x),  # down
            (y, x - 1),  # left
            (y, x + 1),  # right
        ]
        
        for ny, nx in neighbors:
            # Skip if out of bounds
            if ny < 0 or ny >= height or nx < 0 or nx >= width:
                continue
            
            # Get the location at this pixel
            pixel_color = tuple(locations_array[ny, nx])
            pixel_location = color_to_name.get(pixel_color)
            
            # Determine if this pixel is in a third location (not loc1 or loc2)
            is_third_location = pixel_location is not None and pixel_location not in {loc1, loc2}
            
            # Calculate new third_location_count
            if is_third_location:
                new_third_location_count = third_location_count + 1
            else:
                # Reset count when we're back in loc1, loc2, or unassigned
                new_third_location_count = 0
            
            # If we've exceeded tolerance, skip this path
            if new_third_location_count > DIRECT_CONNECTION_TOLERANCE:
                continue
            
            # Skip if already visited with a better (lower) third_location_count
            if (ny, nx) in visited:
                if visited[(ny, nx)] <= new_third_location_count:
                    continue  # We've already visited this pixel with a better path
            
            # Check if this pixel is part of the river component OR within DARK_RIVER_EXTENSION_RADIUS of a dark river
            # Dark rivers are treated as wider, so we allow traversal through adjacent pixels
            is_river_pixel = component_mask[ny, nx]
            is_near_dark_river = is_within_dark_river_range(ny, nx, component_mask, rivers_array, height, width)
            
            if not (is_river_pixel or is_near_dark_river):
                continue
            
            # If this pixel is unassigned (None), check that it's adjacent to loc1 or loc2
            # This prevents false A->C connections when river goes A->B->C (unless tolerance allows it)
            if pixel_location is None:
                adjacent_to_loc1_or_loc2 = False
                for nny, nnx in [(ny-1, nx), (ny+1, nx), (ny, nx-1), (ny, nx+1)]:
                    if nny < 0 or nny >= height or nnx < 0 or nnx >= width:
                        continue
                    neighbor_color = tuple(locations_array[nny, nnx])
                    neighbor_location = color_to_name.get(neighbor_color)
                    if neighbor_location in {loc1, loc2}:
                        adjacent_to_loc1_or_loc2 = True
                        break
                
                # If tolerance is 0, require adjacency (strict mode)
                # If tolerance > 0, allow unassigned pixels as they might be part of a brief traversal
                if DIRECT_CONNECTION_TOLERANCE == 0 and not adjacent_to_loc1_or_loc2:
                    continue
            
            # Track river color at this pixel
            # If it's a direct river pixel, use its color
            # If it's near a dark river, find the nearest dark river color
            if component_mask[ny, nx]:
                river_color = tuple(rivers_array[ny, nx])
                segment_colors.add(rgb_to_hex(river_color))
            else:
                # This pixel is near a dark river, find the dark river color
                for nny, nnx in [(ny-1, nx), (ny+1, nx), (ny, nx-1), (ny, nx+1)]:
                    if nny < 0 or nny >= height or nnx < 0 or nnx >= width:
                        continue
                    if component_mask[nny, nnx]:
                        neighbor_river_color = tuple(rivers_array[nny, nnx])
                        if is_dark_river(neighbor_river_color):
                            segment_colors.add(rgb_to_hex(neighbor_river_color))
                            break
            
            # This is a valid pixel to explore
            queue.append((ny, nx, new_third_location_count))
            visited[(ny, nx)] = new_third_location_count
    
    return False, set()

def calculate_min_distance_between_pixel_sets(pixels1, pixels2):
    """
    Calculate the minimum distance between two sets of pixels.
    Uses Manhattan distance (4-connected).
    Returns the minimum distance and the two closest pixels.
    """
    if not pixels1 or not pixels2:
        return float('inf'), None, None
    
    min_distance = float('inf')
    closest_pixel1 = None
    closest_pixel2 = None
    
    for y1, x1 in pixels1:
        for y2, x2 in pixels2:
            # Manhattan distance
            distance = abs(y1 - y2) + abs(x1 - x2)
            if distance < min_distance:
                min_distance = distance
                closest_pixel1 = (y1, x1)
                closest_pixel2 = (y2, x2)
    
    return min_distance, closest_pixel1, closest_pixel2

def precompute_river_locations(rivers_array, locations_array, color_to_name, cache_file=None, existing_cache=None):
    """
    Precompute which locations each river (connected component) flows through.
    
    Rivers can change color over their trajectory - all connected river pixels are considered
    part of the same river, regardless of color.
    
    Two distinct adjacent provinces A and B are connected by a river if:
    - There is a river (contiguous connected component of river pixels) that overlaps with both A and B
    - That is, if the same river component has pixels in both location A and location B
    
    Uses the global expected_results constant to build expected_river_pairs for logging.
    
    Returns:
        - dict mapping (loc1, loc2) -> dict{river_id: set of colors} - River connections with their segment colors
    
    Args:
        cache_file: If provided, will incrementally save progress to this file
        existing_cache: If provided, will resume from this cached data
    """
    print("Precomputing river-to-location mappings...")
    
    # Build set of expected river/port-river pairs for logging from global expected_results
    expected_river_pairs = set()
    for loc1, loc2, access_type in expected_results:
        if access_type in ('river', 'port-river'):
            pair_key = (loc1, loc2) if loc1 < loc2 else (loc2, loc1)
            expected_river_pairs.add(pair_key)
    
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
        if len(touched_locations) >= 2:
            # Use deterministic ID based on component coordinates
            coords_str = ','.join(f"{y},{x}" for y, x in component_coords_sorted[:1000])
            coords_hash = hashlib.md5(coords_str.encode()).hexdigest()[:8]
            river_id = int(coords_hash, 16) % (2**31)  # Convert hash to integer ID
                
            # Get all river pixel coordinates for this component
            river_pixel_coords = np.argwhere(component_mask)
            
            # For each location, find all river pixels in that location
            # Also include pixels that are within DARK_RIVER_EXTENSION_RADIUS of a dark river (dark rivers are wider)
            location_river_pixels = defaultdict(list)
            
            # First, collect all river pixels directly in locations
            for y, x in river_pixel_coords:
                # Get the location at this river pixel
                pixel_color = tuple(locations_array[y, x])
                pixel_location = color_to_name.get(pixel_color)
                
                if pixel_location:
                    location_river_pixels[pixel_location].append((y, x))
            
            # Now, for dark rivers, also include pixels that are within DARK_RIVER_EXTENSION_RADIUS of the dark river
            # This makes dark rivers effectively wider (1 + 2*DARK_RIVER_EXTENSION_RADIUS pixels wide)
            # Only check pixels near the river component (within 2 pixels) for efficiency
            if DARK_RIVER_EXTENSION_RADIUS > 0:
                height, width = locations_array.shape[:2]
                checked_pixels = set()
                
                # For each river pixel, check its neighbors (within DARK_RIVER_EXTENSION_RADIUS)
                for y, x in river_pixel_coords:
                    # Check if this river pixel is dark
                    river_color = tuple(rivers_array[y, x])
                    if is_dark_river(river_color):
                        # Check all neighbors within DARK_RIVER_EXTENSION_RADIUS (including diagonals)
                        for dy in range(-DARK_RIVER_EXTENSION_RADIUS, DARK_RIVER_EXTENSION_RADIUS + 1):
                            for dx in range(-DARK_RIVER_EXTENSION_RADIUS, DARK_RIVER_EXTENSION_RADIUS + 1):
                                ny, nx = y + dy, x + dx
                                if ny < 0 or ny >= height or nx < 0 or nx >= width:
                                    continue    
                                
                                # Skip if already a river pixel (already counted)
                                if component_mask[ny, nx]:
                                    continue
                                
                                # Skip if already checked
                                if (ny, nx) in checked_pixels:
                                    continue
                                checked_pixels.add((ny, nx))
                                
                                # Get the location at this pixel
                                pixel_color = tuple(locations_array[ny, nx])
                                pixel_location = color_to_name.get(pixel_color)
                                
                                if pixel_location:
                                    # Only add if not already in the list (avoid duplicates)
                                    if (ny, nx) not in location_river_pixels[pixel_location]:
                                        location_river_pixels[pixel_location].append((ny, nx))
            
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
                    
                    # Ensure alphabetical order for pair key
                    pair_key = (loc1, loc2) if loc1 < loc2 else (loc2, loc1)
                    is_expected_pair = expected_river_pairs and pair_key in expected_river_pairs
                    
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
                        
                        # Log for expected pairs
                        if is_expected_pair:
                            print(f"  ✓ River connection found: {loc1} <-> {loc2} (river_id={river_id}, colors={sorted(segment_colors)})")
                    else:
                        # Log for expected pairs that couldn't connect
                        if is_expected_pair:
                            min_distance, closest_p1, closest_p2 = calculate_min_distance_between_pixel_sets(
                                loc1_pixels, loc2_pixels
                            )
                            print(f"  ✗ River connection NOT found: {loc1} <-> {loc2} (min distance: {min_distance} pixels, "
                                  f"closest pixels: {closest_p1} <-> {closest_p2})")
            
            # Mark as processed
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
        pair_key = (loc1, loc2) if loc1 < loc2 else (loc2, loc1)
        if pair_key in location_pair_to_rivers and location_pair_to_rivers[pair_key]:
            # If there's a river connection, prefer that
            return 'port-river'
        return 'port'
    
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

def diagnose_location_pair(loc1, loc2, actual_access_type, locations_array, rivers_array, color_to_name, name_to_color,
                          sea_zones, lakes, location_pair_to_rivers, 
                          wasteland_locations):
    """
    Perform detailed diagnosis of why a location pair was classified the way it was.
    Returns a detailed diagnostic dictionary.
    """
    diagnostic = {
        'locationA': loc1,
        'locationB': loc2,
        'is_adjacent': False,
        'loc1_info': {},
        'loc2_info': {},
        'river_analysis': {}
    }
    
    # Check if locations are recognized
    loc1_color = name_to_color.get(loc1)
    loc2_color = name_to_color.get(loc2)
    
    # Derive river colors from location_pair_to_rivers
    location_to_river_colors = derive_location_to_river_colors(location_pair_to_rivers)
    
    # Analyze river colors for both locations
    loc1_river_colors = list(location_to_river_colors.get(loc1, []))
    loc2_river_colors = list(location_to_river_colors.get(loc2, []))
    loc1_river_analysis = analyze_river_colors(loc1_river_colors)
    loc2_river_analysis = analyze_river_colors(loc2_river_colors)
    
    diagnostic['loc1_info'] = {
        'recognized': loc1_color is not None,
        'is_sea': loc1 in sea_zones,
        'is_lake': loc1 in lakes,
        'is_wasteland': loc1 in wasteland_locations,
        'has_river_colors': loc1_river_colors,
        'river_color_analysis': loc1_river_analysis
    }
    
    diagnostic['loc2_info'] = {
        'recognized': loc2_color is not None,
        'is_sea': loc2 in sea_zones,
        'is_lake': loc2 in lakes,
        'is_wasteland': loc2 in wasteland_locations,
        'has_river_colors': loc2_river_colors,
        'river_color_analysis': loc2_river_analysis
    }
    
    if not loc1_color or not loc2_color:
        return diagnostic
    
    # Check adjacency in locations map
    height, width = locations_array.shape[:2]
    loc1_color_tuple = tuple(loc1_color) if isinstance(loc1_color, (list, np.ndarray)) else loc1_color
    loc2_color_tuple = tuple(loc2_color) if isinstance(loc2_color, (list, np.ndarray)) else loc2_color
    
    # Check horizontal adjacencies
    adjacent_found = False
    for y in range(height):
        for x in range(width - 1):
            pixel1_color = tuple(locations_array[y, x])
            pixel2_color = tuple(locations_array[y, x + 1])
            if (pixel1_color == loc1_color_tuple and pixel2_color == loc2_color_tuple) or \
               (pixel1_color == loc2_color_tuple and pixel2_color == loc1_color_tuple):
                adjacent_found = True
                break
        if adjacent_found:
            break
    
    # Check vertical adjacencies if not found horizontally
    if not adjacent_found:
        for y in range(height - 1):
            for x in range(width):
                pixel1_color = tuple(locations_array[y, x])
                pixel2_color = tuple(locations_array[y + 1, x])
                if (pixel1_color == loc1_color_tuple and pixel2_color == loc2_color_tuple) or \
                   (pixel1_color == loc2_color_tuple and pixel2_color == loc1_color_tuple):
                    adjacent_found = True
                    break
            if adjacent_found:
                break
    
    diagnostic['is_adjacent'] = adjacent_found
    
    # Check river connection
    pair_key = (loc1, loc2) if loc1 < loc2 else (loc2, loc1)
    rivers_dict = location_pair_to_rivers.get(pair_key, {})
    has_river_connection = len(rivers_dict) > 0
    # Extract river_ids and colors from the new structure
    river_connections = {}
    for river_id, colors in rivers_dict.items():
        river_connections[river_id] = list(colors)
    
    diagnostic['river_analysis'] = {
        'has_river_connection': has_river_connection,
        'river_connections': river_connections,  # {river_id: [colors]}
        'river_ids': list(rivers_dict.keys()),  # For backward compatibility
        'actual_access_type': actual_access_type  # Store the actual access type from CSV
    }
    
    # Analyze river pixels if locations have river colors
    if location_to_river_colors.get(loc1) or location_to_river_colors.get(loc2):
        # Find river pixels for these locations
        white = np.array([255, 255, 255])
        sea_pink = np.array([255, 0, 128])
        is_river = ~(np.all(rivers_array == white, axis=-1) | np.all(rivers_array == sea_pink, axis=-1))
        
        # Count river pixels in each location
        loc1_mask = np.all(locations_array == loc1_color_tuple, axis=-1)
        loc2_mask = np.all(locations_array == loc2_color_tuple, axis=-1)
        
        loc1_river_pixels = np.sum(is_river & loc1_mask)
        loc2_river_pixels = np.sum(is_river & loc2_mask)
        
        # Count pixels that are within DARK_RIVER_EXTENSION_RADIUS of dark rivers
        # This includes both direct river pixels and pixels adjacent to dark rivers
        loc1_dark_river_extended_count = 0  # Pixels in loc1 within DARK_RIVER_EXTENSION_RADIUS of dark rivers
        loc2_dark_river_extended_count = 0  # Pixels in loc2 within DARK_RIVER_EXTENSION_RADIUS of dark rivers
        loc1_has_dark_river = False
        loc2_has_dark_river = False
        
        # Count interior river pixels - only scan pixels that are actually river pixels in these locations
        loc1_interior_count = 0
        loc2_interior_count = 0
        
        # Count border river pixels (river pixels adjacent to the other location)
        # A border river pixel is a river pixel in one location that has a 4-connected neighbor 
        # (in locations map) that is the other location.
        # 
        # It's possible to have 0 border pixels if:
        # - The river flows through the interior of both locations
        # - The river doesn't directly cross their shared border (e.g., enters/exits at different points)
        # - The border pixels are assigned in a way that doesn't create direct adjacency
        #   (e.g., river flows through A's interior, exits A, flows through intermediate space,
        #    then enters B's interior, without river pixels directly at the A-B border)
        loc1_border_river_count = 0  # River pixels in loc1 adjacent to loc2
        loc2_border_river_count = 0  # River pixels in loc2 adjacent to loc1
        
        # Also check for river pixels that are BETWEEN the two locations (not assigned to either)
        # This can happen if the river flows along a very thin border or through unclaimed space
        between_border_river_count = 0
        
        # Get only the river pixels in each location (much faster than scanning entire image)
        loc1_river_mask = loc1_mask & is_river
        loc2_river_mask = loc2_mask & is_river
        
        # Get coordinates of river pixels in each location
        loc1_river_coords = np.argwhere(loc1_river_mask)
        loc2_river_coords = np.argwhere(loc2_river_mask)
        
        # Process loc1 river pixels
        for y, x in loc1_river_coords:
            # Check if this is a dark river (for width extension rule)
            river_color = tuple(rivers_array[y, x])
            if is_dark_river(river_color):
                loc1_has_dark_river = True
            
            is_interior = is_interior_pixel(y, x, loc1, locations_array, color_to_name, height, width)
            if is_interior:
                loc1_interior_count += 1
            
            # Check if this river pixel is at the border with loc2
            # A border pixel is one where a neighbor (in locations map) is loc2
            neighbors = [
                (y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)
            ]
            for ny, nx in neighbors:
                if ny < 0 or ny >= height or nx < 0 or nx >= width:
                    continue
                neighbor_color = tuple(locations_array[ny, nx])
                neighbor_location = color_to_name.get(neighbor_color)
                if neighbor_location == loc2:
                    loc1_border_river_count += 1
                    break
        
        # Count pixels in loc1 that are within DARK_RIVER_EXTENSION_RADIUS of dark rivers
        # Only check pixels near actual river pixels for efficiency
        if loc1_has_dark_river:
            checked_pixels = set()
            for y, x in loc1_river_coords:
                # Check all neighbors within 1 pixel (including diagonals for 3-pixel width)
                for dy in [-1, 0, 1]:
                    for dx in [-1, 0, 1]:
                        ny, nx = y + dy, x + dx
                        if ny < 0 or ny >= height or nx < 0 or nx >= width:
                            continue
                        if not loc1_mask[ny, nx]:
                            continue
                        if (ny, nx) in checked_pixels:
                            continue
                        checked_pixels.add((ny, nx))
                        # Check if this pixel is within DARK_RIVER_EXTENSION_RADIUS of a dark river
                        if is_within_dark_river_range(ny, nx, is_river, rivers_array, height, width):
                            loc1_dark_river_extended_count += 1
        
        # Process loc2 river pixels
        for y, x in loc2_river_coords:
            # Check if this is a dark river (for width extension rule)
            river_color = tuple(rivers_array[y, x])
            if is_dark_river(river_color):
                loc2_has_dark_river = True
            
            is_interior = is_interior_pixel(y, x, loc2, locations_array, color_to_name, height, width)
            if is_interior:
                loc2_interior_count += 1
            
            # Check if this river pixel is at the border with loc1
            neighbors = [
                (y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)
            ]
            for ny, nx in neighbors:
                if ny < 0 or ny >= height or nx < 0 or nx >= width:
                    continue
                neighbor_color = tuple(locations_array[ny, nx])
                neighbor_location = color_to_name.get(neighbor_color)
                if neighbor_location == loc1:
                    loc2_border_river_count += 1
                    break
        
        # Count pixels in loc2 that are within DARK_RIVER_EXTENSION_RADIUS of dark rivers
        # Only check pixels near actual river pixels for efficiency
        if loc2_has_dark_river:
            checked_pixels = set()
            for y, x in loc2_river_coords:
                # Check all neighbors within 1 pixel (including diagonals for 3-pixel width)
                for dy in [-1, 0, 1]:
                    for dx in [-1, 0, 1]:
                        ny, nx = y + dy, x + dx
                        if ny < 0 or ny >= height or nx < 0 or nx >= width:
                            continue
                        if not loc2_mask[ny, nx]:
                            continue
                        if (ny, nx) in checked_pixels:
                            continue
                        checked_pixels.add((ny, nx))
                        # Check if this pixel is within DARK_RIVER_EXTENSION_RADIUS of a dark river
                        if is_within_dark_river_range(ny, nx, is_river, rivers_array, height, width):
                            loc2_dark_river_extended_count += 1
        
        
        # Determine if river runs "between" (at border) or "through" (in interior)
        total_border_pixels = loc1_border_river_count + loc2_border_river_count
        total_interior_pixels = loc1_interior_count + loc2_interior_count
        total_river_pixels = int(loc1_river_pixels) + int(loc2_river_pixels)
        
        # Calculate percentages
        border_percentage = (total_border_pixels / total_river_pixels * 100) if total_river_pixels > 0 else 0
        interior_percentage = (total_interior_pixels / total_river_pixels * 100) if total_river_pixels > 0 else 0
        
        # Determine primary pattern
        if total_river_pixels == 0:
            river_pattern = 'none'
        elif total_interior_pixels > total_border_pixels:
            river_pattern = 'through'  # River primarily flows through interior
        elif total_border_pixels > total_interior_pixels:
            river_pattern = 'between'  # River primarily runs at border
        else:
            river_pattern = 'mixed'  # Equal or similar amounts
        
        # Check if dark river width extension rule was applied (if either location has dark rivers)
        dark_river_rule_applied = loc1_has_dark_river or loc2_has_dark_river
        
        diagnostic['river_analysis'].update({
            'loc1_river_pixels': int(loc1_river_pixels),
            'loc2_river_pixels': int(loc2_river_pixels),
            'loc1_interior_river_pixels': loc1_interior_count,
            'loc2_interior_river_pixels': loc2_interior_count,
            'loc1_border_river_pixels': loc1_border_river_count,
            'loc2_border_river_pixels': loc2_border_river_count,
            'total_border_river_pixels': total_border_pixels,
            'total_interior_river_pixels': total_interior_pixels,
            'border_percentage': round(border_percentage, 1),
            'interior_percentage': round(interior_percentage, 1),
            'river_pattern': river_pattern,  # 'between', 'through', 'mixed', or 'none'
            'dark_river_rule_applied': dark_river_rule_applied,
            'dark_river_extension_radius': DARK_RIVER_EXTENSION_RADIUS,
            'loc1_has_dark_river': loc1_has_dark_river,
            'loc2_has_dark_river': loc2_has_dark_river,
            'loc1_dark_river_extended_pixels': loc1_dark_river_extended_count,
            'loc2_dark_river_extended_pixels': loc2_dark_river_extended_count
        })
    
    return diagnostic

def validate_results(actual_results, color_to_name, name_to_color, log_file_path=None,
                     locations_array=None, rivers_array=None, sea_zones=None, lakes=None,
                     location_pair_to_rivers=None, wasteland_locations=None):
    """
    Validate actual results against expected results.
    Logs comprehensive breakdown of differences and unrecognized locations.
    Does not fail the program, only logs warnings.
    
    Uses the global expected_results constant.
    
    Args:
        actual_results: List of (loc1, loc2, access_type) tuples from generated data
        color_to_name: Dictionary mapping color tuples to location names
        log_file_path: Optional path to log file. If provided, logs will be written to file.
    """
    # Create a list to collect all log messages
    log_messages = []
    
    def log(message):
        """Log message to both console and log file."""
        print(message)
        log_messages.append(message)
    
    log("\n" + "="*80)
    log("VALIDATING RESULTS AGAINST EXPECTED VALUES")
    log("="*80)
    
    # Create a lookup dictionary from actual results: (loc1, loc2) -> access_type
    # Ensure alphabetical order for consistent lookup
    actual_lookup = {}
    all_actual_locations = set()
    for loc1, loc2, access_type in actual_results:
        # Ensure alphabetical order
        if loc1 > loc2:
            loc1, loc2 = loc2, loc1
        pair_key = (loc1, loc2)
        actual_lookup[pair_key] = access_type
        all_actual_locations.add(loc1)
        all_actual_locations.add(loc2)
    
    # Get all recognized locations from color_to_name
    all_recognized_locations = set(color_to_name.values())
    
    # Track issues
    missing_pairs = []
    wrong_access_type = []
    unrecognized_locations = []
    correct_matches = []
    
    # Perform detailed diagnosis for each expected result
    diagnostics = []
    
    print(f"\nRunning diagnostics for {len(expected_results)} expected results...")
    
    # Check each expected result
    for idx, expected in enumerate(expected_results, 1):
        if idx % 5 == 0 or idx == 1:
            print(f"  Diagnosing {idx}/{len(expected_results)}...")
        if len(expected) != 3:
            log(f"⚠️  WARNING: Invalid expected result format: {expected} (expected [loc1, loc2, accessType])")
            continue
        
        loc1, loc2, expected_access_type = expected
        
        # Ensure alphabetical order for lookup
        if loc1 > loc2:
            loc1, loc2 = loc2, loc1
        
        pair_key = (loc1, loc2)
        
        # Get the actual access type from the CSV results (what was actually output)
        actual_access_type = actual_lookup.get(pair_key, 'missing')
        
        # Perform detailed diagnosis if diagnostic data is available
        diagnostic = None
        if (locations_array is not None and rivers_array is not None and 
            sea_zones is not None and lakes is not None and 
            location_pair_to_rivers is not None and
            wasteland_locations is not None):
            try:
                diagnostic = diagnose_location_pair(
                    loc1, loc2, actual_access_type, locations_array, rivers_array, color_to_name, name_to_color,
                    sea_zones, lakes, location_pair_to_rivers,
                    wasteland_locations
                )
                diagnostics.append({
                    'expected': expected_access_type,
                    'diagnostic': diagnostic
                })
            except Exception as e:
                log(f"⚠️  Error diagnosing {loc1} <-> {loc2}: {e}")
        
        # Check if locations are recognized
        loc1_recognized = loc1 in all_recognized_locations
        loc2_recognized = loc2 in all_recognized_locations
        
        if not loc1_recognized:
            if loc1 not in unrecognized_locations:
                unrecognized_locations.append(loc1)
        if not loc2_recognized:
            if loc2 not in unrecognized_locations:
                unrecognized_locations.append(loc2)
        
        # Check if pair exists in actual results
        if pair_key not in actual_lookup:
            missing_pairs.append({
                'locationA': loc1,
                'locationB': loc2,
                'expectedAccessType': expected_access_type,
                'loc1_recognized': loc1_recognized,
                'loc2_recognized': loc2_recognized,
                'diagnostic': diagnostic
            })
        else:
            actual_access_type = actual_lookup[pair_key]
            if actual_access_type != expected_access_type:
                wrong_access_type.append({
                    'locationA': loc1,
                    'locationB': loc2,
                    'expectedAccessType': expected_access_type,
                    'actualAccessType': actual_access_type,
                    'diagnostic': diagnostic
                })
            else:
                correct_matches.append({
                    'locationA': loc1,
                    'locationB': loc2,
                    'accessType': expected_access_type,
                    'diagnostic': diagnostic
                })
    
    # Print comprehensive breakdown
    total_expected = len(expected_results)
    total_correct = len(correct_matches)
    total_issues = len(missing_pairs) + len(wrong_access_type) + len(unrecognized_locations)
    
    log(f"\nSummary:")
    log(f"  Total expected results: {total_expected}")
    log(f"  ✓ Correct matches: {total_correct}")
    log(f"  ✗ Issues found: {total_issues}")
    
    # Report unrecognized locations
    if unrecognized_locations:
        log(f"\n⚠️  UNRECOGNIZED LOCATIONS ({len(unrecognized_locations)}):")
        log("   These locations are not found in the color mapping.")
        log("   This might indicate a typo in the expected results or missing location data.")
        for loc in sorted(unrecognized_locations):
            log(f"     - {loc}")
    
    # Report missing pairs with detailed diagnostics
    if missing_pairs:
        log(f"\n⚠️  MISSING PAIRS ({len(missing_pairs)}):")
        log("   These expected adjacency pairs were not found in the generated results.")
        for item in missing_pairs:
            loc1_status = "✓ recognized" if item['loc1_recognized'] else "✗ UNRECOGNIZED"
            loc2_status = "✓ recognized" if item['loc2_recognized'] else "✗ UNRECOGNIZED"
            log(f"     - {item['locationA']} <-> {item['locationB']} (expected: {item['expectedAccessType']})")
            log(f"       Location A: {loc1_status}, Location B: {loc2_status}")
            
            # Add detailed diagnostic if available
            if item.get('diagnostic'):
                diag = item['diagnostic']
                log(f"       DIAGNOSTIC:")
                log(f"         - Adjacent: {diag.get('is_adjacent', 'unknown')}")
                log(f"         - Loc1: sea={diag['loc1_info'].get('is_sea')}, lake={diag['loc1_info'].get('is_lake')}, "
                    f"river_colors={len(diag['loc1_info'].get('has_river_colors', []))}")
                loc1_river_analysis = diag['loc1_info'].get('river_color_analysis', {})
                if loc1_river_analysis.get('darkest_color'):
                    log(f"         - Loc1 darkest river: {loc1_river_analysis['darkest_color']} "
                        f"(brightness: {loc1_river_analysis['darkest_brightness']:.1f}, "
                        f"darker than typical: {loc1_river_analysis.get('is_darker_than_typical', False)})")
                log(f"         - Loc2: sea={diag['loc2_info'].get('is_sea')}, lake={diag['loc2_info'].get('is_lake')}, "
                    f"river_colors={len(diag['loc2_info'].get('has_river_colors', []))}")
                loc2_river_analysis = diag['loc2_info'].get('river_color_analysis', {})
                if loc2_river_analysis.get('darkest_color'):
                    log(f"         - Loc2 darkest river: {loc2_river_analysis['darkest_color']} "
                        f"(brightness: {loc2_river_analysis['darkest_brightness']:.1f}, "
                        f"darker than typical: {loc2_river_analysis.get('is_darker_than_typical', False)})")
                river_analysis = diag.get('river_analysis', {})
                log(f"         - River connection: {river_analysis.get('has_river_connection', False)}")
                if 'loc1_interior_river_pixels' in river_analysis:
                    log(f"         - Loc1 interior river pixels: {river_analysis.get('loc1_interior_river_pixels', 0)}")
                    log(f"         - Loc1 border river pixels: {river_analysis.get('loc1_border_river_pixels', 0)} "
                        f"(river pixels in loc1 that are directly adjacent to loc2)")
                    log(f"         - Loc2 interior river pixels: {river_analysis.get('loc2_interior_river_pixels', 0)}")
                    log(f"         - Loc2 border river pixels: {river_analysis.get('loc2_border_river_pixels', 0)} "
                        f"(river pixels in loc2 that are directly adjacent to loc1)")
                # Use actual_access_type from the diagnostic or from the item
                actual_type = item.get('actualAccessType') or item.get('diagnostic', {}).get('actual_access_type', 'unknown')
                log(f"         - Classified as: {actual_type}")
    
    # Report wrong access types with detailed diagnostics
    if wrong_access_type:
        log(f"\n⚠️  WRONG ACCESS TYPES ({len(wrong_access_type)}):")
        log("   These pairs exist but have a different access type than expected.")
        for item in wrong_access_type:
            log(f"     - {item['locationA']} <-> {item['locationB']}")
            log(f"       Expected: {item['expectedAccessType']}, Actual: {item['actualAccessType']}")
            
            # Add detailed diagnostic if available
            if item.get('diagnostic'):
                diag = item['diagnostic']
                log(f"       DIAGNOSTIC:")
                log(f"         - Adjacent: {diag.get('is_adjacent', 'unknown')}")
                log(f"         - Loc1: sea={diag['loc1_info'].get('is_sea')}, lake={diag['loc1_info'].get('is_lake')}, "
                    f"river_colors={len(diag['loc1_info'].get('has_river_colors', []))}")
                loc1_river_analysis = diag['loc1_info'].get('river_color_analysis', {})
                if loc1_river_analysis.get('darkest_color'):
                    log(f"         - Loc1 darkest river: {loc1_river_analysis['darkest_color']} "
                        f"(brightness: {loc1_river_analysis['darkest_brightness']:.1f}, "
                        f"darker than typical: {loc1_river_analysis.get('is_darker_than_typical', False)})")
                log(f"         - Loc2: sea={diag['loc2_info'].get('is_sea')}, lake={diag['loc2_info'].get('is_lake')}, "
                    f"river_colors={len(diag['loc2_info'].get('has_river_colors', []))}")
                loc2_river_analysis = diag['loc2_info'].get('river_color_analysis', {})
                if loc2_river_analysis.get('darkest_color'):
                    log(f"         - Loc2 darkest river: {loc2_river_analysis['darkest_color']} "
                        f"(brightness: {loc2_river_analysis['darkest_brightness']:.1f}, "
                        f"darker than typical: {loc2_river_analysis.get('is_darker_than_typical', False)})")
                river_analysis = diag.get('river_analysis', {})
                log(f"         - River connection: {river_analysis.get('has_river_connection', False)}")
                if 'loc1_interior_river_pixels' in river_analysis:
                    log(f"         - Loc1 interior river pixels: {river_analysis.get('loc1_interior_river_pixels', 0)}")
                    log(f"         - Loc1 border river pixels: {river_analysis.get('loc1_border_river_pixels', 0)} "
                        f"(river pixels in loc1 directly adjacent to loc2; 0 means river flows through interior, not at shared border)")
                    log(f"         - Loc2 interior river pixels: {river_analysis.get('loc2_interior_river_pixels', 0)}")
                    log(f"         - Loc2 border river pixels: {river_analysis.get('loc2_border_river_pixels', 0)} "
                        f"(river pixels in loc2 directly adjacent to loc1; 0 means river flows through interior, not at shared border)")
                    if 'river_pattern' in river_analysis:
                        log(f"         - River pattern: {river_analysis.get('river_pattern', 'unknown')} "
                            f"(border: {river_analysis.get('border_percentage', 0):.1f}%, "
                            f"interior: {river_analysis.get('interior_percentage', 0):.1f}%)")
                    # Show dark river width extension rule information
                    if river_analysis.get('dark_river_rule_applied', False):
                        extension_radius = river_analysis.get('dark_river_extension_radius', DARK_RIVER_EXTENSION_RADIUS)
                        log(f"         - DARK RIVER WIDTH EXTENSION APPLIED (radius={extension_radius}): Dark river detected (darker than baseline {TYPICAL_RIVER_BLUE_HEX})")
                        if river_analysis.get('loc1_has_dark_river', False):
                            log(f"           * Loc1 has dark river: {river_analysis.get('loc1_dark_river_extended_pixels', 0)} pixels within {extension_radius}px of dark river")
                        if river_analysis.get('loc2_has_dark_river', False):
                            log(f"           * Loc2 has dark river: {river_analysis.get('loc2_dark_river_extended_pixels', 0)} pixels within {extension_radius}px of dark river")
                # Use actual_access_type from the diagnostic or from the item
                actual_type = item.get('actualAccessType') or item.get('diagnostic', {}).get('actual_access_type', 'unknown')
                log(f"         - Classified as: {actual_type}")
    
    # Report correct matches (optional, for verification)
    if correct_matches and total_issues == 0:
        log(f"\n✓ All {total_correct} expected results matched correctly!")
    elif correct_matches:
        log(f"\n✓ Correct matches ({total_correct}):")
        for item in correct_matches:
            log(f"     - {item['locationA']} <-> {item['locationB']}: {item['accessType']}")
    
    # Print IMPORTANT warning if there are issues
    if total_issues > 0:
        log("\n" + "!"*80)
        log("⚠️  IMPORTANT WARNING: VALIDATION FAILED")
        log("!"*80)
        log(f"   {total_issues} issue(s) found when validating against expected results.")
        log("   Please review the breakdown above.")
        log("   The program will continue, but results may not match expectations.")
        log("!"*80 + "\n")
    else:
        log("\n✓ All validations passed!\n")
    
    log("="*80 + "\n")
    
    # Add detailed diagnostics section for all expected results
    if diagnostics:
        log("\n" + "="*80)
        log("DETAILED DIAGNOSTICS FOR ALL EXPECTED RESULTS")
        log("="*80)
        
        for diag_entry in diagnostics:
            expected = diag_entry['expected']
            diag = diag_entry['diagnostic']
            loc1 = diag['locationA']
            loc2 = diag['locationB']
            
            log(f"\n{'='*80}")
            log(f"EXPECTED: {loc1} <-> {loc2} = {expected}")
            log(f"{'='*80}")
            
            # Location info
            log(f"\nLocation A ({loc1}):")
            loc1_info = diag['loc1_info']
            log(f"  - Recognized: {loc1_info.get('recognized', False)}")
            log(f"  - Is Sea: {loc1_info.get('is_sea', False)}")
            log(f"  - Is Lake: {loc1_info.get('is_lake', False)}")
            log(f"  - Is Wasteland: {loc1_info.get('is_wasteland', False)}")
            log(f"  - River Colors (hex): {loc1_info.get('has_river_colors', [])}")
            
            # River color analysis for loc1
            loc1_river_analysis = loc1_info.get('river_color_analysis', {})
            if loc1_river_analysis.get('colors'):
                log(f"  - River Color Analysis:")
                for color_info in loc1_river_analysis['colors']:
                    log(f"      * Hex: {color_info['hex']}, RGB: {color_info['rgb']}, "
                        f"Brightness: {color_info['brightness']:.1f}, "
                        f"Darker than typical: {color_info['is_darker_than_typical']}")
                if loc1_river_analysis.get('darkest_color'):
                    log(f"      * Darkest: {loc1_river_analysis['darkest_color']} "
                        f"(brightness: {loc1_river_analysis['darkest_brightness']:.1f}, "
                        f"typical river blue: {loc1_river_analysis.get('typical_river_blue_brightness', TYPICAL_RIVER_BLUE_BRIGHTNESS):.1f} "
                        f"[RGB {loc1_river_analysis.get('typical_river_blue_rgb', TYPICAL_RIVER_BLUE_RGB)}])")
                    log(f"      * Is darker than typical: {loc1_river_analysis.get('is_darker_than_typical', False)}")
                    if loc1_river_analysis.get('brightness_difference', 0) > 0:
                        log(f"      * Brightness difference from typical: {loc1_river_analysis['brightness_difference']:.1f} "
                            f"(darker by this amount)")
            
            log(f"\nLocation B ({loc2}):")
            loc2_info = diag['loc2_info']
            log(f"  - Recognized: {loc2_info.get('recognized', False)}")
            log(f"  - Is Sea: {loc2_info.get('is_sea', False)}")
            log(f"  - Is Lake: {loc2_info.get('is_lake', False)}")
            log(f"  - Is Wasteland: {loc2_info.get('is_wasteland', False)}")
            log(f"  - River Colors (hex): {loc2_info.get('has_river_colors', [])}")
            
            # River color analysis for loc2
            loc2_river_analysis = loc2_info.get('river_color_analysis', {})
            if loc2_river_analysis.get('colors'):
                log(f"  - River Color Analysis:")
                for color_info in loc2_river_analysis['colors']:
                    log(f"      * Hex: {color_info['hex']}, RGB: {color_info['rgb']}, "
                        f"Brightness: {color_info['brightness']:.1f}, "
                        f"Darker than typical: {color_info['is_darker_than_typical']}")
                if loc2_river_analysis.get('darkest_color'):
                    log(f"      * Darkest: {loc2_river_analysis['darkest_color']} "
                        f"(brightness: {loc2_river_analysis['darkest_brightness']:.1f}, "
                        f"typical river blue: {loc2_river_analysis.get('typical_river_blue_brightness', TYPICAL_RIVER_BLUE_BRIGHTNESS):.1f} "
                        f"[RGB {loc2_river_analysis.get('typical_river_blue_rgb', TYPICAL_RIVER_BLUE_RGB)}])")
                    log(f"      * Is darker than typical: {loc2_river_analysis.get('is_darker_than_typical', False)}")
                    if loc2_river_analysis.get('brightness_difference', 0) > 0:
                        log(f"      * Brightness difference from typical: {loc2_river_analysis['brightness_difference']:.1f} "
                            f"(darker by this amount)")
            
            # Adjacency
            log(f"\nAdjacency:")
            log(f"  - Are Adjacent: {diag.get('is_adjacent', False)}")
            
            # River analysis
            river_analysis = diag.get('river_analysis', {})
            log(f"\nRiver Analysis:")
            log(f"  - Has River Connection: {river_analysis.get('has_river_connection', False)}")
            log(f"  - River IDs: {river_analysis.get('river_ids', [])}")
            if 'loc1_river_pixels' in river_analysis:
                log(f"  - Loc1 Total River Pixels: {river_analysis.get('loc1_river_pixels', 0)}")
                log(f"  - Loc1 Interior River Pixels: {river_analysis.get('loc1_interior_river_pixels', 0)}")
                log(f"  - Loc2 Total River Pixels: {river_analysis.get('loc2_river_pixels', 0)}")
                log(f"  - Loc2 Interior River Pixels: {river_analysis.get('loc2_interior_river_pixels', 0)}")
                # Show dark river width extension rule information
                if river_analysis.get('dark_river_rule_applied', False):
                    extension_radius = river_analysis.get('dark_river_extension_radius', DARK_RIVER_EXTENSION_RADIUS)
                    log(f"  - DARK RIVER WIDTH EXTENSION APPLIED (radius={extension_radius}): Dark river detected (darker than baseline {TYPICAL_RIVER_BLUE_HEX})")
                    if river_analysis.get('loc1_has_dark_river', False):
                        log(f"    * Loc1 has dark river: {river_analysis.get('loc1_dark_river_extended_pixels', 0)} pixels within {extension_radius}px of dark river")
                    if river_analysis.get('loc2_has_dark_river', False):
                        log(f"    * Loc2 has dark river: {river_analysis.get('loc2_dark_river_extended_pixels', 0)} pixels within {extension_radius}px of dark river")
            
            # Classification
            # Get actual access type from diagnostic (which was set from CSV)
            actual_access_type_from_diag = diag.get('actual_access_type', 'unknown')
            log(f"\nActual Result from CSV:")
            log(f"  - Access Type: {actual_access_type_from_diag}")
            
            # Also check actual result directly from lookup (should match)
            pair_key = (loc1, loc2) if loc1 < loc2 else (loc2, loc1)
            actual_type_from_lookup = actual_lookup.get(pair_key, 'NOT FOUND')
            log(f"\nActual Result (from lookup):")
            log(f"  - Access Type: {actual_type_from_lookup}")
            log(f"  - Matches Expected: {actual_type == expected}")
        
        log(f"\n{'='*80}\n")
    
    # Write to log file if path provided
    if log_file_path:
        try:
            with open(log_file_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(log_messages))
            print(f"✓ Validation report written to: {log_file_path}")
        except Exception as e:
            print(f"⚠️  Warning: Could not write validation report to {log_file_path}: {e}")

def main():
    start_time = time.time()
    version, game_data_path, use_cache = parse_arguments()
    
    if DIRECT_CONNECTION_TOLERANCE > 0:
        print(f"Using direct connection tolerance: {DIRECT_CONNECTION_TOLERANCE} pixels")
    
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
    # Derive from location_pair_to_rivers (aggregate all colors for each location)
    river_colors_output = os.path.join(output_dir, 'location-river-colors.json')
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

    
    # Validate results against expected
    report_log_path = os.path.join(output_dir, 'report.log')
    validate_results(
        results, color_to_name, name_to_color, log_file_path=report_log_path,
        locations_array=locations_array, rivers_array=rivers_array,
        sea_zones=sea_zones, lakes=lakes,
        location_pair_to_rivers=location_pair_to_rivers,
        wasteland_locations=wasteland_locations
    )

if __name__ == '__main__':
    main()
