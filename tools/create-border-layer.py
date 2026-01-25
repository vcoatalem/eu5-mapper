from sys import argv
from PIL import Image
import numpy as np

def createColorBorders(color_map_filename: str, output_file: str = "borders.png", border_color: str = "#3a454d"):
    """
    Creates a transparent image with borders between different colored regions.
    
    Args:
        color_map_filename: Path to input image with plain color areas
        output_file: Path to save output image with borders
        border_color: Hex color for the borders (default: #85c5f2)
    """
    print(f"Creating borders from {color_map_filename}...")
    
    # Convert border color to RGB
    border_hex = border_color.lstrip('#')
    border_rgb = tuple(int(border_hex[i:i+2], 16) for i in (0, 2, 4))
    print(f"Border color: {border_rgb}")
    
    # Load image
    print("Loading image...")
    img = Image.open(color_map_filename).convert('RGB')
    img_array = np.array(img)
    height, width = img_array.shape[:2]
    
    print(f"Processing {width}x{height} image...")
    
    # Convert RGB to single integer for easier comparison
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
    
    print(f"Found {np.sum(border_mask)} border pixels")
    
    # Create output RGBA image
    output_array = np.zeros((height, width, 4), dtype=np.uint8)
    output_array[border_mask] = [border_rgb[0], border_rgb[1], border_rgb[2], 255]
    
    print("Saving output...")
    output = Image.fromarray(output_array, 'RGBA')
    output.save(output_file)
    print("Done!")

output_file: str = "border_layer.png"

createColorBorders(argv[1], output_file)
