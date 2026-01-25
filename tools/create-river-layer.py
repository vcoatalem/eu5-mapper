from sys import argv
from pathlib import Path
from typing import Tuple

import numpy as np
from PIL import Image


def create_river_layer(
    input_path: str,
    output_path: str = "river_layer.png",
    white_threshold: int = 245,
    pink_color: Tuple[int, int, int] = (255, 0, 128),
    pink_tolerance: int = 3,
) -> Path:
    """Create a transparent layer containing only river pixels.

    Any pixel that is nearly white (land) or bright pink (sea) becomes fully
    transparent. All other pixels are preserved with full opacity.
    """
    source = Path(input_path)
    target = Path(output_path)

    if not source.exists():
        raise FileNotFoundError(f"Input file not found: {source}")

    print(f"Loading {source}...")
    image = Image.open(source).convert("RGBA")
    data = np.array(image)
    rgb = data[:, :, :3]

    white_mask = (rgb >= white_threshold).all(axis=2)
    pink_target = np.array(pink_color, dtype=np.int16)
    diff = np.abs(rgb.astype(np.int16) - pink_target)
    pink_mask = (diff <= pink_tolerance).all(axis=2)

    keep_mask = ~(white_mask | pink_mask)

    output = np.zeros_like(data)
    output[keep_mask] = data[keep_mask]

    result = Image.fromarray(output, mode="RGBA")
    result.save(target)

    kept_pixels = int(np.sum(keep_mask))
    total_pixels = keep_mask.size
    print(f"Kept {kept_pixels} of {total_pixels} pixels as rivers")
    print(f"Saved to {target}")

    return target


if __name__ == "__main__":
    if len(argv) < 2:
        raise SystemExit("Usage: python create-river-layer.py <rivers.png>")

    input_file = argv[1]

    create_river_layer(input_file)
