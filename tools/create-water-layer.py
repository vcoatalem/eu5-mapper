import subprocess
from sys import argv
from PIL import Image
import numpy as np


def getWaterCodes(colorMapFilename) -> list[int]:
  try:

    water_terms = [
      'lake', 'salt_pan', 'gulf', 'bay', 'strait', 'harbour', 'harbor',
      'lagoon', 'sea', 'ocean', 'archipelago', 'cape', 'atlantic',
      'pacific', 'coast', 'point', 'island', 'islands',
      'estuary', 'mouth', 'mouths', 'fjord', 'fjords', 'cove', 'sound',
      'gap', 'ridge', 'highseas', 'delta', 'channel', 'inlet', 'inlets',
      'current', 'southcurrent', 'monsooncurrent', 'countercurrent', 'southequatorialcurrent', 'northagulhascurrent', 'equatorialcountercurrent', 'capricorn'
      'alaams', # specific, area around Alaska
      'ushant', 'gironde', 'ile_de_re', 'riviera', # specific french terminology
      'thames', 'head', 'bloody_foreland', 'lough_foyle', 'butt_of_lewis', 'uist', 'firth', 'seven_sisters', 'solent', 'haven', 'severn', 'wash', # specific GB terminology
      'kust',  'kusten', 'tralhavet', 'gavlebukten', 'botnia', 'kvarken', 'baltic', 'balt', 'bugt', 'kattegatt', # specific swedish / danish / NL terminology
      'costa', 'trafalgar', 'baixas', 'rias', 'ponta', 'baia', 'cap_nau' # specific iberia terminology
    ]

    
    terms_pattern = '|'.join(water_terms)


    grep_command = rf"grep -iE '(^|[^a-zA-Z])({terms_pattern})([^a-zA-Z]|$).*=' {colorMapFilename} | sed 's/.*= *\([a-f0-9]*\).*/\1/'"

    print("Running command:", grep_command)


    command = rf"""
     {grep_command}
    """
    
    # Run the command
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
    )
    
    # Store the result
    output = result.stdout
    error = result.stderr
    return_code = result.returncode
    
    if error:
        print("\nError:")
        print(error)
    
    print(f"\nReturn code: {return_code}")
    
  except IndexError:
      print("Error: No file path provided")
      print("Usage: python3 script.py <file_path>")
  except Exception as e:
      print(f"An error occurred: {e}")

  codes = output.splitlines()
  #codesWithPrefix = ['#' + code for code in codes]

  codesToInt = [int(code, 16) for code in codes if code != '']

  return codesToInt


def fillWaterCodes(waterCodes: list[str], colorMapFilename: str, output_file: str = "water_layer.png"):

  print("enter fillWaterCodes with args", str(waterCodes[0:10]) + "..." + str(waterCodes[-10:]), colorMapFilename, output_file)

  print("Loading image...")
  img = Image.open(colorMapFilename).convert('RGB')
  img_array = np.array(img)
  height, width = img_array.shape[:2]

  print(f"Processing {width}x{height} image...")

  # Convert RGB to single integer for comparison
  # Shape: (height, width)
  color_ints = (img_array[:,:,0].astype(np.uint32) << 16) | \
              (img_array[:,:,1].astype(np.uint32) << 8) | \
              img_array[:,:,2].astype(np.uint32)

  # Create mask where any pixel matches any water color
  print("Creating mask...")
  mask = np.isin(color_ints, list(waterCodes))

  print(f"Found {np.sum(mask)} matching pixels")

  # Create output RGBA image
  output_array = np.zeros((height, width, 4), dtype=np.uint8)
  output_array[mask] = [39, 39, 171, 255]

  output = Image.fromarray(output_array, 'RGBA')
  output.save(output_file)

colorMapFilename = argv[1]
waterCodes = getWaterCodes(colorMapFilename)

fillWaterCodes(waterCodes, argv[2])
