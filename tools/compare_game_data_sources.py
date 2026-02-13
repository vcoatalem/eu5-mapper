#!/usr/bin/env python3
r"""
Generate static game data from app and game sources, then compare outputs.

Usage:
    python compare_game_data_sources.py <version> --game-root "C:\Path\To\Europa Universalis V"

Notes:
    - Uses EU5MapApp/game_data for computed files.
    - Writes outputs to tools/output_compare/<version>/{app,game}
"""

import argparse
import hashlib
import json
import os
from typing import Any, List, Tuple

from generate_static_game_data import generate_game_data_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare app vs game data outputs")
    parser.add_argument("version", help="Game data version (e.g., 0.0.11)")
    parser.add_argument(
        "--game-root",
        required=True,
        help="Root folder of installed game (e.g., C:\\Program Files (x86)\\Steam\\steamapps\\common\\Europa Universalis V)",
    )
    return parser.parse_args()


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def sha256_file(path: str) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def summarize_json_diff(a: Any, b: Any) -> str:
    if type(a) is not type(b):
        return f"Type differs: {type(a).__name__} vs {type(b).__name__}"

    if isinstance(a, dict):
        keys_a = set(a.keys())
        keys_b = set(b.keys())
        only_a = sorted(keys_a - keys_b)
        only_b = sorted(keys_b - keys_a)
        summary = [f"keys: {len(keys_a)} vs {len(keys_b)}"]
        if only_a:
            preview = ", ".join(only_a[:10])
            summary.append(f"only app: {len(only_a)} ({preview})")
        if only_b:
            preview = ", ".join(only_b[:10])
            summary.append(f"only game: {len(only_b)} ({preview})")
        return "; ".join(summary)

    if isinstance(a, list):
        return f"list length: {len(a)} vs {len(b)}"

    return "values differ"


def write_location_data_map_diff(
    app_path: str,
    game_path: str,
    diff_path: str
) -> None:
    app_json = load_json(app_path)
    game_json = load_json(game_path)

    if not isinstance(app_json, dict) or not isinstance(game_json, dict):
        return

    app_keys = set(app_json.keys())
    game_keys = set(game_json.keys())
    only_app = sorted(app_keys - game_keys)
    only_game = sorted(game_keys - app_keys)
    common_keys = sorted(app_keys & game_keys)

    lines: List[str] = []
    lines.append(f"File: location-data-map.json")
    lines.append(f"App: {app_path}")
    lines.append(f"Game: {game_path}")
    lines.append("")
    lines.append(f"Only app: {len(only_app)}")
    if only_app:
        lines.append(", ".join(only_app))
    lines.append("")
    lines.append(f"Only game: {len(only_game)}")
    if only_game:
        lines.append(", ".join(only_game))

    lines.append("")
    lines.append("Differences by location:")
    for key in common_keys:
        app_val = app_json.get(key)
        game_val = game_json.get(key)
        if app_val == game_val:
            continue
        lines.append("")
        lines.append(f"location: {key}")

        if isinstance(app_val, dict) and isinstance(game_val, dict):
            app_fields = set(app_val.keys())
            game_fields = set(game_val.keys())
            for field in sorted(app_fields | game_fields):
                a_field = app_val.get(field)
                g_field = game_val.get(field)
                if a_field != g_field:
                    lines.append(f"  {field} app: {a_field}")
                    lines.append(f"  {field} game: {g_field}")
        else:
            lines.append(f"  app: {app_val}")
            lines.append(f"  game: {game_val}")

    os.makedirs(os.path.dirname(diff_path), exist_ok=True)
    with open(diff_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def collect_output_files(output_dir: str) -> List[str]:
    files: List[str] = []
    for root, _, filenames in os.walk(output_dir):
        for filename in filenames:
            full_path = os.path.join(root, filename)
            if os.path.isfile(full_path):
                rel_path = os.path.relpath(full_path, output_dir)
                files.append(rel_path)
    return sorted(files)


def compare_outputs(
    app_dir: str,
    game_dir: str,
    diff_dir: str
) -> Tuple[List[str], List[str]]:
    app_files = set(collect_output_files(app_dir))
    game_files = set(collect_output_files(game_dir))

    only_app = sorted(app_files - game_files)
    only_game = sorted(game_files - app_files)
    common = sorted(app_files & game_files)

    diffs = []
    for filename in common:
        app_path = os.path.join(app_dir, filename)
        game_path = os.path.join(game_dir, filename)

        if filename.lower().endswith(".json"):
            app_json = load_json(app_path)
            game_json = load_json(game_path)
            if app_json != game_json:
                if filename == "location-data-map.json":
                    os.makedirs(diff_dir, exist_ok=True)
                    diff_path = os.path.join(diff_dir, "location-data-map.json.diff.txt")
                    write_location_data_map_diff(app_path, game_path, diff_path)
                    diffs.append(f"{filename}: detailed diff (see {diff_path})")
                    continue
                summary = summarize_json_diff(app_json, game_json)
                diffs.append(f"{filename}: {summary}")
        elif filename.lower().endswith(".png"):
            if sha256_file(app_path) != sha256_file(game_path):
                diffs.append(f"{filename}: image content differs")
        elif filename.lower().endswith(".csv"):
            with open(app_path, "r", encoding="utf-8") as f:
                app_lines = f.read().splitlines()
            with open(game_path, "r", encoding="utf-8") as f:
                game_lines = f.read().splitlines()

            if app_lines != game_lines:
                os.makedirs(diff_dir, exist_ok=True)
                diff_path = os.path.join(diff_dir, f"{filename}.diff.txt")
                diff_lines: List[str] = []
                diff_lines.append(f"File: {filename}")
                diff_lines.append(f"App: {app_path}")
                diff_lines.append(f"Game: {game_path}")
                diff_lines.append("")

                if app_lines and game_lines:
                    app_header = app_lines[0].split(",")
                    game_header = game_lines[0].split(",")
                else:
                    app_header = []
                    game_header = []

                if app_header == game_header and "location" in app_header:
                    key_index = app_header.index("location")

                    def to_row_map(lines: List[str]) -> dict:
                        row_map = {}
                        for line in lines[1:]:
                            if not line:
                                continue
                            parts = line.split(",")
                            if key_index >= len(parts):
                                continue
                            key = parts[key_index]
                            row_map[key] = parts
                        return row_map

                    app_rows = to_row_map(app_lines)
                    game_rows = to_row_map(game_lines)
                    app_keys = set(app_rows.keys())
                    game_keys = set(game_rows.keys())

                    diff_lines.append("Keyed differences (by location):")
                    only_app = sorted(app_keys - game_keys)
                    only_game = sorted(game_keys - app_keys)
                    if only_app:
                        diff_lines.append(f"only app: {len(only_app)} ({', '.join(only_app[:25])})")
                    if only_game:
                        diff_lines.append(f"only game: {len(only_game)} ({', '.join(only_game[:25])})")

                    common_keys = sorted(app_keys & game_keys)
                    for key in common_keys:
                        app_row = app_rows[key]
                        game_row = game_rows[key]
                        if app_row != game_row:
                            diff_lines.append("")
                            diff_lines.append(f"location: {key}")
                            for idx, col_name in enumerate(app_header):
                                app_val = app_row[idx] if idx < len(app_row) else ""
                                game_val = game_row[idx] if idx < len(game_row) else ""
                                if app_val != game_val:
                                    diff_lines.append(f"  {col_name} app: {app_val}")
                                    diff_lines.append(f"  {col_name} game: {game_val}")
                else:
                    max_len = max(len(app_lines), len(game_lines))
                    diff_lines.append("Line-by-line differences:")
                    for idx in range(max_len):
                        app_line = app_lines[idx] if idx < len(app_lines) else ""
                        game_line = game_lines[idx] if idx < len(game_lines) else ""
                        if app_line != game_line:
                            line_no = idx + 1
                            diff_lines.append(f"line {line_no} app: {app_line}")
                            diff_lines.append(f"line {line_no} game: {game_line}")

                with open(diff_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(diff_lines))

                diffs.append(f"{filename}: line-by-line differences (see {diff_path})")
        else:
            if sha256_file(app_path) != sha256_file(game_path):
                diffs.append(f"{filename}: file hash differs")

    return diffs, common


def main() -> None:
    args = parse_args()
    version = args.version
    game_root = args.game_root.strip().strip('"').strip("'")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_base = os.path.join(script_dir, "output_compare", version)
    app_output = os.path.join(output_base, "app")
    game_output = os.path.join(output_base, "game")
    report_path = os.path.join(output_base, "compare_report.txt")

    ensure_dir(app_output)
    ensure_dir(game_output)

    print("Generating app-based outputs...")
    generate_game_data_json(version, app_output, source="app")

    print("\nGenerating game-based outputs...")
    generate_game_data_json(
        version,
        game_output,
        source="game",
        game_root_path=game_root
    )

    diff_dir = os.path.join(output_base, "diffs")
    diffs, common = compare_outputs(app_output, game_output, diff_dir)

    lines: List[str] = []
    lines.append(f"Version: {version}")
    lines.append(f"App output: {app_output}")
    lines.append(f"Game output: {game_output}")
    lines.append("")
    if diffs:
        lines.append("Differences found:")
        for diff in diffs:
            lines.append(f"- {diff}")
    else:
        lines.append("No differences found in output files.")

    lines.append("")
    lines.append("Compared files:")
    for filename in common:
        lines.append(f"- {filename}")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nReport written to: {report_path}")
    print(f"Outputs written to: {output_base}")


if __name__ == "__main__":
    main()
