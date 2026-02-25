"""Classify river layer images using OCR."""

import argparse
import os
import re
from typing import List, Set, Tuple

from PIL import Image
import pytesseract
import cv2
import numpy as np

from location_input import read_river_image_locations, resolve_versioned_file

# Configure pytesseract path (update if installed elsewhere)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

PROXIMITY_HEADER = "Proximity is improved towards the following Locations:"
NO_RIVER_TEXT = "No river flows through this Location."

# Log OCR text for these locations (lowercase names)
LOG_OCR_LOCATIONS = {"aalst", "abadan", "abiy_addi", "aaboukingon", "wycombe", "zimapan", "dulgalaax_trail", "yinjiang"}


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
	"""Preprocess an image to improve OCR results."""
	gray = img.convert("L")
	np_img = np.array(gray)
	np_img = cv2.resize(np_img, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
	_, np_img = cv2.threshold(np_img, 170, 255, cv2.THRESH_BINARY)
	return Image.fromarray(np_img)


def ocr_image(img_path: str) -> str:
	"""OCR an image with preprocessing."""
	img = Image.open(img_path)
	img = preprocess_for_ocr(img)
	return pytesseract.image_to_string(img, config="--oem 3 --psm 11")


def extract_good_results(text: str) -> List[str]:
	"""Extract proximity list lines after the proximity header."""
	lower = text.lower()
	start_match = re.search(r"proximity\s+is\s+improved\s+towards\s+the\s+following\s+loca\w*", lower)
	if not start_match:
		return []
	start_idx = start_match.end()
	end_match = re.search(r"crossing\s+combat\s+penalty", lower[start_idx:])
	end_idx = start_idx + end_match.start() if end_match else len(text)

	segment = text[start_idx:end_idx]
	lines = [line.strip() for line in segment.split("\n") if line.strip()]
	results: List[str] = []
	for line in lines:
		cleaned = re.sub(r"^[^A-Za-z0-9_]+", "", line).strip()
		tokens = re.findall(r"[a-z0-9_\-]+", cleaned)
		if tokens:
			# Prefer the longest token (e.g., skip leading 'e' from '(e) kuttawa').
			best = max(tokens, key=len)
			results.append(best)
	return results


def normalize_location_for_text(location: str) -> str:
	"""Normalize a location key into a text-friendly form for matching."""
	clean = re.sub(r"[_\-]+", " ", location.lower())
	clean = re.sub(r"[^a-z0-9\s]+", " ", clean)
	return re.sub(r"\s+", " ", clean).strip()


def contains_river_in_location(text: str, location: str) -> bool:
	"""Check for a 'River in <location>' string in OCR text."""
	text_norm = re.sub(r"[^a-z0-9\s]+", " ", text.lower())
	text_norm = re.sub(r"\s+", " ", text_norm).strip()
	loc_norm = normalize_location_for_text(location)
	needle = f"river in {loc_norm}"
	if needle in text_norm:
		return True
	needle_len = len(needle)
	if needle_len == 0 or len(text_norm) < needle_len:
		return False
	for start in range(0, len(text_norm) - needle_len + 1):
		window = text_norm[start : start + needle_len]
		if levenshtein_limited(window, needle, 1) <= 1:
			return True
	return False


def allowed_distance(name: str) -> int:
	"""Allow 1 edit per 4 chars (min 1)."""
	return max(1, len(name) // 4)


def levenshtein_limited(a: str, b: str, max_dist: int) -> int:
	"""Levenshtein distance with early exit when exceeding max_dist."""
	if abs(len(a) - len(b)) > max_dist:
		return max_dist + 1
	if a == b:
		return 0
	prev = list(range(len(b) + 1))
	for i, ca in enumerate(a, 1):
		cur = [i]
		min_row = cur[0]
		for j, cb in enumerate(b, 1):
			cost = 0 if ca == cb else 1
			cur_val = min(
				prev[j] + 1,
				cur[j - 1] + 1,
				prev[j - 1] + cost,
			)
			cur.append(cur_val)
			if cur_val < min_row:
				min_row = cur_val
		prev = cur
		if min_row > max_dist:
			return max_dist + 1
	if prev[-1] > max_dist:
		return max_dist + 1
	return prev[-1]


def match_with_tolerance(token: str, templates_by_first: dict) -> str:
	"""Match token to closest template within tolerance; return empty if none."""
	if not token:
		return ""
	first = token[0]
	candidates = templates_by_first.get(first, [])
	all_candidates = templates_by_first.get("*", [])
	max_dist = allowed_distance(token)
	best = ""
	best_dist = max_dist + 1
	best_len = 0
	for cand in candidates:
		if abs(len(cand) - len(token)) > max_dist:
			continue
		dist = levenshtein_limited(token, cand, max_dist)
		cand_len = len(cand)
		if dist < best_dist:
			best_dist = dist
			best = cand
			best_len = cand_len
			if best_dist == 0:
				break
		elif dist == best_dist:
			same_len = cand_len == len(token)
			best_same_len = best_len == len(token)
			if same_len and not best_same_len:
				best = cand
				best_len = cand_len
			elif same_len == best_same_len and cand_len > best_len:
				best = cand
				best_len = cand_len

	if best_dist > max_dist and all_candidates and candidates is not all_candidates:
		for cand in all_candidates:
			if abs(len(cand) - len(token)) > max_dist:
				continue
			dist = levenshtein_limited(token, cand, max_dist)
			cand_len = len(cand)
			if dist < best_dist:
				best_dist = dist
				best = cand
				best_len = cand_len
				if best_dist == 0:
					break
			elif dist == best_dist:
				same_len = cand_len == len(token)
				best_same_len = best_len == len(token)
				if same_len and not best_same_len:
					best = cand
					best_len = cand_len
				elif same_len == best_same_len and cand_len > best_len:
					best = cand
					best_len = cand_len
	return best if best_dist <= max_dist else ""


def debug_match_report(location: str, tokens: List[str], templates_by_first: dict) -> None:
	"""Write a detailed match report for a location if enabled."""
	if location.lower() not in LOG_OCR_LOCATIONS:
		return
	log_dir = os.path.join(os.path.dirname(__file__), "classification_logs")
	os.makedirs(log_dir, exist_ok=True)
	log_path = os.path.join(log_dir, f"{location}.txt")
	lines = []
	lines.append(f"location: {location}")
	lines.append(f"tokens: {', '.join(tokens)}")
	lines.append("")
	for token in tokens:
		if not token:
			continue
		first = token[0]
		candidates = templates_by_first.get(first, [])
		all_candidates = templates_by_first.get("*", [])
		fallback_used = False
		max_dist = allowed_distance(token)
		best = ""
		best_dist = max_dist + 1
		for cand in candidates:
			if abs(len(cand) - len(token)) > max_dist:
				continue
			dist = levenshtein_limited(token, cand, max_dist)
			if dist < best_dist:
				best_dist = dist
				best = cand
				if best_dist == 0:
					break
		if best_dist > max_dist and all_candidates and candidates is not all_candidates:
			fallback_used = True
			for cand in all_candidates:
				if abs(len(cand) - len(token)) > max_dist:
					continue
				dist = levenshtein_limited(token, cand, max_dist)
				if dist < best_dist:
					best_dist = dist
					best = cand
					if best_dist == 0:
						break
			
		status = "MATCH" if best_dist <= max_dist else "NO_MATCH"
		fallback_note = " fallback=full" if fallback_used else ""
		lines.append(
			f"token={token} max_dist={max_dist} best={best} best_dist={best_dist} {status} candidates={len(candidates)}{fallback_note}"
		)
	with open(log_path, "w", encoding="utf-8") as f:
		f.write("\n".join(lines))


def classify_location(text: str, templates_by_first: dict, location: str, land_river_locations: Set[str]) -> Tuple[str, List[str]]:
	"""Classify OCR content and return (status, good_results)."""
	if location in land_river_locations and not contains_river_in_location(text, location):
		return "picture is of another location", []
	if re.search(r"\bseazone\b", text, re.IGNORECASE):
		return "seazone", []
	if re.search(r"\bcorridor\b", text, re.IGNORECASE):
		return "corridor", []
	if re.search(r"\bimpassable\b", text, re.IGNORECASE):
		return "", []
	if NO_RIVER_TEXT.lower() in text.lower():
		return "no river", []

	good_results = extract_good_results(text)
	if good_results:
		matched = []
		for token in good_results:
			match = match_with_tolerance(token, templates_by_first)
			if match:
				matched.append(match)
		if matched:
			return "good result", matched

	if PROXIMITY_HEADER.lower() in text.lower():
		return "good result", []

	return "non conclusive", []


def load_processed(output_path: str) -> set:
	"""Load already processed locations from output CSV."""
	import csv

	processed = set()
	if not os.path.exists(output_path):
		return processed
	with open(output_path, "r", newline="", encoding="utf-8") as f:
		sample = f.read(2048)
		f.seek(0)
		has_header = "location" in sample.split("\n", 1)[0].lower()
		if has_header:
			reader = csv.DictReader(f)
			for row in reader:
				location = (row.get("location") or "").strip()
				if location:
					processed.add(location)
		else:
			reader = csv.reader(f)
			for row in reader:
				if not row:
					continue
				location = (row[0] or "").strip()
				if location and location.lower() != "location":
					processed.add(location)
	return processed


def append_row(output_path: str, row: List[str]):
	"""Append a single row to the output CSV, creating it if needed."""
	import csv

	write_header = not os.path.exists(output_path)
	with open(output_path, "a", newline="", encoding="utf-8") as f:
		writer = csv.writer(f)
		if write_header:
			writer.writerow(["location", "status", "good_results"])
		writer.writerow(row)


def log_ocr_text(location: str, text: str):
	"""Log OCR text to file for specified locations."""
	if location.lower() not in LOG_OCR_LOCATIONS:
		return
	log_dir = os.path.join(os.path.dirname(__file__), "ocr_logs")
	os.makedirs(log_dir, exist_ok=True)
	log_path = os.path.join(log_dir, f"{location}_ocr.txt")
	with open(log_path, "w", encoding="utf-8") as f:
		f.write(text)


def main():
	project_root = os.path.join(os.path.dirname(__file__), '..', '..')
	parser = argparse.ArgumentParser(description="Classify river layer images via OCR")
	parser.add_argument(
		"--version",
		required=True,
		help="Game data version (e.g., 1.0.11)",
	)
	parser.add_argument(
		"--input",
		default=None,
		help="Path to location-river-colors.json",
	)
	parser.add_argument(
		"--images",
		default=None,
		help="Folder containing <location>-river_layer_image.png files",
	)

	parser.add_argument(
		"--templates",
		default=r"C:\Program Files (x86)\Steam\steamapps\common\Europa Universalis V\game\in_game\map_data\location_templates.txt",
		help="Path to location_templates.txt",
	)
	args = parser.parse_args()


	if not args.input:
		args.input, resolved_version = resolve_versioned_file(
			os.path.join(project_root, "game_data", "computed_river_colors"),
			args.version,
			"location-river-colors.json",
		)
		if resolved_version != args.version:
			print(
				f"Version {args.version} not found; using {resolved_version} for river colors"
			)
	if not args.images:
		args.images = os.path.join(
			os.path.dirname(__file__),
			"scrapped_river_location_images",
			args.version,
		)

	args.output = os.path.join(
		os.path.dirname(__file__),
		"river_classification_output",
		args.version,
		"river_layer_classification.csv",
	)
	os.makedirs(os.path.dirname(args.output), exist_ok=True)

	locations, templates, land_locations = read_river_image_locations(args.input, args.templates)
	land_river_locations = set(locations)
	templates_by_first = {}
	for name in templates:
		first = name[0] if name else ""
		templates_by_first.setdefault(first, []).append(name)
	templates_by_first["*"] = templates
	processed = load_processed(args.output)

	remaining = [loc for loc in land_river_locations if loc not in processed]
	total = len(remaining)
	print(f"Already processed: {len(processed)}")
	print(f"Remaining: {total}\n")
	for idx, location in enumerate(remaining, 1):
		filename = f"{location}-river_layer_image.png"
		image_path = os.path.join(args.images, filename)
		if not os.path.exists(image_path):
			append_row(args.output, [location, "image not found", ""])
			print(f"[{idx}/{total}] {location}: image not found")
			continue

		ocr_text = ocr_image(image_path)
		log_ocr_text(location, ocr_text)

		tokens = extract_good_results(ocr_text)
		debug_match_report(location, tokens, templates_by_first)

		status, good_results = classify_location(ocr_text, templates_by_first, location, land_river_locations)
		good_results_str = "|".join(good_results)
		append_row(args.output, [location, status, good_results_str])
		print(f"[{idx}/{total}] {location}: {status} ({len(good_results)} results)")

	print(f"\nWrote classification to: {args.output}")


if __name__ == "__main__":
	main()
