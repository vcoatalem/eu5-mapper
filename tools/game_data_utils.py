"""
Utility functions for loading and parsing game data files.
"""

def hex_to_rgb(hex_str):
    """Convert hex string to RGB tuple."""
    hex_str = hex_str.strip().lstrip('#')
    if len(hex_str) == 6:
        return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))
    elif len(hex_str) == 4:  # Handle short format like "1e05"
        return tuple(int(hex_str[i:i+2], 16) for i in (0, 2))  # This would be incomplete
    else:
        # Handle abbreviated hex codes (like "1e05" which is actually 001e05)
        hex_str = hex_str.zfill(6)
        return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))


def load_color_to_name_mapping(color_mapping_file):
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


def parse_default_map(default_map_file):
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
