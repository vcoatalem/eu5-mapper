"""EU5 Screen Coordinate Calibrator."""

import time
import pyautogui


def get_mouse_position():
	"""Display current mouse position."""
	print("Move your mouse to the target position...")
	print("Press Ctrl+C when done\n")
	try:
		while True:
			x, y = pyautogui.position()
			print(f"X: {x:4d}, Y: {y:4d}", end="\r")
			time.sleep(0.1)
	except KeyboardInterrupt:
		x, y = pyautogui.position()
		print(f"\nFinal position: X={x}, Y={y}")
		return x, y


def main():
	print("EU5 Screen Coordinate Calibrator")
	print("=" * 60)
	get_mouse_position()


if __name__ == "__main__":
	main()
