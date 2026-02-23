"""EU5 River Scraper - captures river tooltip images."""

import argparse
import csv
import time
import re
import mss
import pyautogui
from PIL import Image
import pytesseract
import cv2
import numpy as np
import threading
import ctypes
import subprocess
import os
from typing import List
import pyperclip

from location_input import read_river_image_locations, resolve_versioned_file

# Configure pytesseract path (update this to your installation path)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

is_paused = False
should_stop = False


def listen_for_enter():
	"""Listen for Enter key press to pause/resume execution."""
	global is_paused, should_stop
	while not should_stop:
		try:
			input()
		except EOFError:
			break
		is_paused = not is_paused
		status = "PAUSED" if is_paused else "RESUMED"
		print(f"\n{'='*50}")
		print(f"  {status}")
		print(f"{'='*50}\n")


def wait_if_paused():
	while is_paused and not should_stop:
		time.sleep(0.1)


def capture_screen_region(x: int, y: int, width: int, height: int) -> Image.Image:
	with mss.mss() as sct:
		monitor = {"top": y, "left": x, "width": width, "height": height}
		screenshot = sct.grab(monitor)
		img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
	return img


def type_text(text: str, interval: float = 0.05, use_clipboard: bool = True):
	if use_clipboard:
		pyperclip.copy(text)
		pyautogui.hotkey("ctrl", "v")
		time.sleep(0.2)
		return
	pyautogui.typewrite(text, interval=interval)
	time.sleep(0.2)


def click_at(x: int, y: int):
	pyautogui.click(x, y)
	time.sleep(0.3)


def move_to(x: int, y: int, duration: float = 0.3):
	pyautogui.moveTo(x, y, duration=duration)
	time.sleep(0.3)


def send_key_vk(vk: int, hold: float = 0.0):
	user32 = ctypes.windll.user32

	class KEYBDINPUT(ctypes.Structure):
		_fields_ = [
			("wVk", ctypes.c_ushort),
			("wScan", ctypes.c_ushort),
			("dwFlags", ctypes.c_ulong),
			("time", ctypes.c_ulong),
			("dwExtraInfo", ctypes.c_void_p),
		]

	class INPUT(ctypes.Structure):
		_fields_ = [("type", ctypes.c_ulong), ("ki", KEYBDINPUT)]

	INPUT_KEYBOARD = 1
	KEYEVENTF_KEYUP = 0x0002

	down = INPUT(INPUT_KEYBOARD, KEYBDINPUT(vk, 0, 0, 0, None))
	up = INPUT(INPUT_KEYBOARD, KEYBDINPUT(vk, 0, KEYEVENTF_KEYUP, 0, None))

	user32.SendInput(1, ctypes.byref(down), ctypes.sizeof(INPUT))
	if hold > 0:
		time.sleep(hold)
	user32.SendInput(1, ctypes.byref(up), ctypes.sizeof(INPUT))


def open_console(config: dict):
	ahk_exe = config.get("ahk_exe_path")
	ahk_script = config.get("ahk_script_path")
	ahk_title = config.get("ahk_window_title")
	if not ahk_exe or not ahk_script:
		print("AHK: missing path(s) in config")
		return
	if not os.path.exists(ahk_exe):
		print(f"AHK: exe not found at {ahk_exe}")
		return
	if not os.path.exists(ahk_script):
		print(f"AHK: script not found at {ahk_script}")
		return

	cmd = [ahk_exe, ahk_script]
	if ahk_title:
		cmd.append(ahk_title)
	result = subprocess.run(cmd, check=False, capture_output=True, text=True)
	if result.stdout:
		print(f"AHK stdout: {result.stdout.strip()}")
	if result.stderr:
		print(f"AHK stderr: {result.stderr.strip()}")
	print(f"AHK exit code: {result.returncode}")
	time.sleep(0.2)


def send_enter_ahk(config: dict):
	ahk_exe = config.get("ahk_exe_path")
	ahk_title = config.get("ahk_window_title")
	ahk_script = r"C:\Users\victo\Documents\VsCode\EU5MapApp\tools\scrapping\send_enter.ahk"
	if not ahk_exe or not os.path.exists(ahk_exe):
		print("AHK: exe not found for Enter")
		return
	if not os.path.exists(ahk_script):
		print("AHK: send_enter.ahk not found")
		return
	cmd = [ahk_exe, ahk_script]
	if ahk_title:
		cmd.append(ahk_title)
	subprocess.run(cmd, check=False, capture_output=True, text=True)
	time.sleep(0.1)


def run_goto_command(location_name: str, config: dict):
	prefix = config.get("goto_command_prefix", "goto ")
	command = f"{prefix}{location_name}"
	type_text(command, use_clipboard=True)
	send_enter_ahk(config)
	time.sleep(0.05)
	send_enter_ahk(config)
	time.sleep(config.get("goto_command_delay", 0.5))


def capture_tooltip_image_near_cursor() -> Image.Image:
	mx, my = pyautogui.position()
	width = 800
	screen_width, screen_height = pyautogui.size()
	x = mx + 20
	if x + width > screen_width:
		x = max(0, screen_width - width)
	if x < 0:
		x = 0
	y = 0
	height = screen_height
	img = capture_screen_region(x, y, width, height)
	return img


def sanitize_filename(name: str) -> str:
	cleaned = re.sub(r"[^A-Za-z0-9_\-]+", "_", name.strip())
	return cleaned.strip("_") or "unknown"


def get_processed_locations(output_dir: str) -> set:
	processed = set()
	if not os.path.isdir(output_dir):
		return processed
	for filename in os.listdir(output_dir):
		if filename.endswith("-river_layer_image.png"):
			location = filename[:-len("-river_layer_image.png")]
			processed.add(location)
	return processed


def process_location(location_name: str, output_dir: str, config: dict) -> int:
	wait_if_paused()
	print(f"Processing: {location_name}")

	open_console(config)

	run_goto_command(location_name, config)

	screen_center_x = config["screen_center_x"]
	screen_center_y = config["screen_center_y"]
	move_to(screen_center_x, screen_center_y, duration=0.3)
	jiggle = config.get("mouse_jiggle", 6)
	move_to(screen_center_x + jiggle, screen_center_y + jiggle, duration=0.1)
	move_to(screen_center_x - jiggle, screen_center_y - jiggle, duration=0.1)
	move_to(screen_center_x, screen_center_y, duration=0.1)
	time.sleep(0.5)

	tooltip_img = capture_tooltip_image_near_cursor()
	os.makedirs(output_dir, exist_ok=True)
	filename = os.path.join(output_dir, f"{sanitize_filename(location_name)}-river_layer_image.png")
	tooltip_img.save(filename)
	print(f"  Saved tooltip image: {filename}")

	open_console(config)
	time.sleep(0.2)

	return 0


def main():
	global should_stop
	project_root = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..')

	config = {
		"screen_center_x": 1290,
		"screen_center_y": 703,
		"goto_command_prefix": "goto ",
		"goto_command_delay": 0.5,
		"mouse_jiggle": 1,
		"ahk_exe_path": r"C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe",
		"ahk_script_path": r"C:\Users\victo\Documents\VsCode\EU5MapApp\tools\scrapping\open_console.ahk",
		"ahk_window_title": "Europa Universalis V",
	}

	parser = argparse.ArgumentParser(description="Scrape river tooltip images")
	parser.add_argument(
		"--version",
		required=True,
		help="Game data version (e.g., 1.0.11)",
	)
	parser.add_argument(
		"--river-colors",
		default=None,
		help="Path to location-river-colors.json",
	)
	parser.add_argument(
		"--templates",
		default=r"C:\Program Files (x86)\Steam\steamapps\common\Europa Universalis V\game\in_game\map_data\location_templates.txt",
		help="Path to location_templates.txt",
	)
	parser.add_argument(
		"--images",
		default=None,
		help="Folder to write <location>-river_layer_image.png files",
	)
	args = parser.parse_args()

	resolved_version = args.version
	if args.river_colors:
		river_colors_file = args.river_colors
	else:
		river_colors_file, resolved_version = resolve_versioned_file(
			os.path.join(project_root, "game_data", "computed_river_colors"),
			args.version,
			"location-river-colors.json",
		)
		if resolved_version != args.version:
			print(
				f"Version {args.version} not found; using {resolved_version} for river colors"
			)
	templates_file = args.templates
	output_dir = os.path.join(
		os.path.dirname(__file__),
		"scrapped_river_location_images",
		args.version,
	)
	os.makedirs(output_dir, exist_ok=True)

	print("EU5 River Scraper")
	print("=" * 60)
	print("Press Enter at any time to PAUSE/RESUME")
	print("Press Ctrl+C to STOP")
	print("=" * 60)
	print()

	print("Reading river image locations from:")
	print(f"  - River colors: {river_colors_file}")
	print(f"  - Templates: {templates_file}")
	locations, _, _ = read_river_image_locations(river_colors_file, templates_file)
	processed = get_processed_locations(output_dir)
	remaining = [loc for loc in locations if sanitize_filename(loc) not in processed]
	print(f"Found {len(locations)} locations (river colors + culture)")
	print(f"Already processed: {len(processed)}")
	print(f"Remaining: {len(remaining)}\n")


	listener_thread = threading.Thread(target=listen_for_enter, daemon=True)
	listener_thread.start()

	print("Switching to EU5 window in 5 seconds...")
	for i in range(5, 0, -1):
		print(f"{i}...")
		time.sleep(1)
	print("Starting!\n")



	total_processed = 0

	try:
		total_locations = len(remaining)
		for idx, location_name in enumerate(remaining, 1):
			if should_stop:
				break

			wait_if_paused()

			if not location_name:
				continue

			print(f"\n[{idx}/{total_locations}] Processing: {location_name} | Remaining: {total_locations - idx}")

			try:
				process_location(location_name, output_dir, config)
				total_processed += 1
			except Exception as e:
				print(f"  ERROR processing {location_name}: {e}")

			time.sleep(0.5)

	except KeyboardInterrupt:
		print("\n\nStopped by user")
	finally:
		should_stop = True

	print(f"\n{'='*60}")
	print("Completed!")
	print(f"Processed: {total_processed} locations")
	print(f"{'='*60}")


if __name__ == "__main__":
	main()
