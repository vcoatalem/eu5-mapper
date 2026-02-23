"""Remove non conclusive rows from river classification CSV and delete images."""

import argparse
import csv
import os
import shutil
from typing import List, Tuple


def detect_header(row: List[str]) -> bool:
	lower = [cell.strip().lower() for cell in row]
	return "location" in lower or "status" in lower


def get_status_index(header: List[str]) -> int:
	lower = [cell.strip().lower() for cell in header]
	if "status" in lower:
		return lower.index("status")
	return 1


def get_location_index(header: List[str]) -> int:
	lower = [cell.strip().lower() for cell in header]
	if "location" in lower:
		return lower.index("location")
	return 0


def sanitize_filename(name: str) -> str:
	cleaned = []
	for ch in name.strip():
		if ch.isalnum() or ch in {"_", "-"}:
			cleaned.append(ch)
		else:
			cleaned.append("_")
	result = "".join(cleaned).strip("_")
	return result or "unknown"


def read_rows(csv_path: str) -> Tuple[bool, List[List[str]]]:
	with open(csv_path, "r", newline="", encoding="utf-8") as f:
		reader = csv.reader(f)
		rows = [row for row in reader if row]
	if not rows:
		return False, []
	has_header = detect_header(rows[0])
	return has_header, rows


def write_rows(csv_path: str, rows: List[List[str]]):
	with open(csv_path, "w", newline="", encoding="utf-8") as f:
		writer = csv.writer(f)
		writer.writerows(rows)


def remove_images(locations: List[str], images_dir: str) -> Tuple[int, int]:
	deleted = 0
	missing = 0
	for location in locations:
		candidates = [
			f"{location}-river_layer_image.png",
			f"{sanitize_filename(location)}-river_layer_image.png",
		]
		found = False
		for filename in candidates:
			path = os.path.join(images_dir, filename)
			if os.path.exists(path):
				os.remove(path)
				deleted += 1
				found = True
				break
		if not found:
			missing += 1
	return deleted, missing


def main():
	project_root = os.path.dirname(os.path.dirname(__file__))
	parser = argparse.ArgumentParser(
		description="Remove non conclusive rows and delete associated images"
	)
	parser.add_argument(
		"--version",
		required=True,
		help="Game data version (e.g., 1.0.11)",
	)
	parser.add_argument(
		"--csv",
		default=None,
		help="Path to river_layer_classification.csv",
	)
	parser.add_argument(
		"--images",
		default=None,
		help="Folder containing river layer images",
	)
	parser.add_argument(
		"--no-backup",
		action="store_true",
		help="Do not create a .bak backup of the CSV",
	)
	args = parser.parse_args()

	if not args.csv:
		args.csv = os.path.join(
			project_root,
			"game_data",
			"computed_river_classification",
			args.version,
			"river_layer_classification.csv",
		)
	if not args.images:
		args.images = os.path.join(
			os.path.dirname(__file__),
			"scrapped_river_location_images",
			args.version,
		)

	if not os.path.exists(args.csv):
		raise SystemExit(f"CSV not found: {args.csv}")
	if not os.path.isdir(args.images):
		raise SystemExit(f"Images folder not found: {args.images}")

	has_header, rows = read_rows(args.csv)
	if not rows:
		print("CSV is empty; nothing to do.")
		return

	start_idx = 1 if has_header else 0
	header = rows[0] if has_header else []
	status_idx = get_status_index(header) if has_header else 1
	location_idx = get_location_index(header) if has_header else 0

	kept_rows = [rows[0]] if has_header else []
	removed_locations: List[str] = []

	remove_statuses = {
		"non conclusive",
		"picture is of another location",
		"image not found",
	}
	for row in rows[start_idx:]:
		if len(row) <= max(status_idx, location_idx):
			kept_rows.append(row)
			continue
		status = (row[status_idx] or "").strip().lower()
		if status in remove_statuses:
			location = (row[location_idx] or "").strip()
			if location and status != "image not found":
				removed_locations.append(location)
			continue
		kept_rows.append(row)

	if not args.no_backup:
		backup_path = f"{args.csv}.bak"
		shutil.copy2(args.csv, backup_path)
		print(f"Backup created: {backup_path}")

	write_rows(args.csv, kept_rows)
	deleted, missing = remove_images(removed_locations, args.images)

	print(f"Removed rows: {len(removed_locations)}")
	print(f"Images deleted: {deleted}")
	print(f"Images missing: {missing}")


if __name__ == "__main__":
	main()
