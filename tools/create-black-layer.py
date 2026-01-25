from sys import argv
from PIL import Image
import numpy as np


def createBlackBackground(input_file: str, output_file: str):
    """
    Creates a solid black image with the same dimensions as the input image.
    
    Args:
        input_file: path to color map image
        output_file: Path to save black background image
    """
    print(f"Creating black background matching {input_file}...")
    
    # Load image to get dimensions
    img = Image.open(input_file)
    width, height = img.size
    
    print(f"Creating {width}x{height} black image...")
    
    # Create black RGB image
    black_array = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Save as PNG
    output = Image.fromarray(black_array, 'RGB')
    output.save(output_file)
    
    print(f"Saved to {output_file}")



output_file: str = "black_layer.png"
createBlackBackground(argv[1], output_file)