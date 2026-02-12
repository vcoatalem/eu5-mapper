#!/usr/bin/env python3
"""
Meta script to orchestrate all data generation for a specific game version.

This script runs all data generation scripts in the correct order:
1. create-border-layer.py - Generate border overlay
2. create-terrain-layer.py - Generate terrain overlay  
3. create-adjacency-data.py - Generate adjacency data and river colors
4. compare-adjacency-data.py - Compare with existing adjacency data
5. generate_location_centers.py - Compute and cache center coordinates for all locations
6. generate_static_game_data.py - Generate final static game data JSON
7. fetch_country_flags.py - Add flag URLs to countries-data-map.json from Paradox wiki

All outputs are stored in tools/output/{version}/ (plus cached center coordinates in tools/tmp/)
"""

import sys
import os
import subprocess
import time
from pathlib import Path


def run_script(script_name: str, args: list, description: str) -> bool:
    """
    Run a Python script and return success status.
    
    Args:
        script_name: Name of the Python script to run
        args: List of command-line arguments
        description: Human-readable description for logging
        
    Returns:
        True if script succeeded, False otherwise
    """
    print(f"\n{'='*80}")
    print(f"🔄 {description}")
    print(f"{'='*80}")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(script_dir, script_name)
    
    cmd = ['python3', script_path] + args
    print(f"Command: {' '.join(cmd)}\n")
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            cmd,
            cwd=script_dir,
            check=True,
            capture_output=False,
            text=True
        )
        
        elapsed = time.time() - start_time
        print(f"\n✅ {description} completed in {elapsed:.1f}s")
        return True
        
    except subprocess.CalledProcessError as e:
        elapsed = time.time() - start_time
        print(f"\n❌ {description} failed after {elapsed:.1f}s")
        print(f"Exit code: {e.returncode}")
        return False
    except FileNotFoundError:
        print(f"\n❌ Script not found: {script_path}")
        return False


def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print("Usage: python generate_all_data.py <version> [--game-data-path <path>]")
        print("Example: python generate_all_data.py 0.0.11")
        print("         python generate_all_data.py 0.0.11 --game-data-path /path/to/game_data")
        sys.exit(1)
    
    version = sys.argv[1]
    extra_args = sys.argv[2:]  # Pass through any additional arguments
    
    # Get paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, 'output', version)
    project_root = os.path.dirname(script_dir)
    game_data_adjacency = os.path.join(project_root, 'game_data', 'special_adjacency_file', version, 'adjacencies.csv')
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n{'='*80}")
    print(f"🚀 STARTING DATA GENERATION FOR VERSION {version}")
    print(f"{'='*80}")
    print(f"Output directory: {output_dir}")
    print(f"Started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    overall_start = time.time()
    
    # Step 1: Generate border layer
    if not run_script(
        'create-border-layer.py',
        [version] + extra_args,
        'Step 1/7: Generate border layer'
    ):
        print("\n❌ Pipeline failed at step 1")
        sys.exit(1)
    
    # Step 2: Generate terrain layer
    if not run_script(
        'create-terrain-layer.py',
        [version] + extra_args,
        'Step 2/7: Generate terrain layer'
    ):
        print("\n❌ Pipeline failed at step 2")
        sys.exit(1)
    
    # Step 3: Generate adjacency data
    if not run_script(
        'create-adjacency-data.py',
        [version] + extra_args,
        'Step 3/7: Generate adjacency data and river colors'
    ):
        print("\n❌ Pipeline failed at step 3")
        sys.exit(1)
    
    # Step 4: Compare adjacency data (if reference file exists)
    generated_adjacency = os.path.join(output_dir, 'adjacency-data.csv')
    if os.path.exists(game_data_adjacency):
        comparison_output = os.path.join(output_dir, 'adjacency-comparison.txt')
        
        # Run comparison and redirect output to file
        print(f"\n{'='*80}")
        print(f"🔄 Step 4/7: Compare adjacency data with reference")
        print(f"{'='*80}")
        print(f"Reference: {game_data_adjacency}")
        print(f"Generated: {generated_adjacency}")
        print(f"Output: {comparison_output}\n")
        
        try:
            with open(comparison_output, 'w') as f:
                result = subprocess.run(
                    ['python3', 'compare-adjacency-data.py', game_data_adjacency, generated_adjacency],
                    cwd=script_dir,
                    capture_output=True,
                    text=True,
                    check=False  # Don't fail on non-zero exit (comparison shows differences)
                )
                f.write(result.stdout)
                if result.stderr:
                    f.write("\n--- STDERR ---\n")
                    f.write(result.stderr)
            
            print(f"✅ Comparison written to {comparison_output}")
            
            # Show summary
            if result.stdout:
                lines = result.stdout.split('\n')
                summary_lines = [l for l in lines if 'difference' in l.lower() or 'identical' in l.lower() or 'added' in l.lower() or 'removed' in l.lower()]
                if summary_lines:
                    print("\nComparison summary:")
                    for line in summary_lines[:10]:  # Show first 10 summary lines
                        print(f"  {line}")
        
        except Exception as e:
            print(f"⚠️  Warning: Comparison failed: {e}")
            print("Continuing with pipeline...")
    else:
        print(f"\n⚠️  Step 4/7: Skipping comparison - reference file not found:")
        print(f"  {game_data_adjacency}")

    # Step 5: Generate and cache location center coordinates
    # Note: we intentionally DO NOT pass extra_args here, since generate_location_centers.py
    # only expects the version (and optional cache flags) and does not take a game data path.
    if not run_script(
        'generate_location_centers.py',
        [version],
        'Step 5/7: Generate location center coordinates (cached)'
    ):
        print("\n❌ Pipeline failed at step 5")
        sys.exit(1)

    # Step 6: Generate static game data
    if not run_script(
        'generate_static_game_data.py',
        [version] + extra_args,
        'Step 6/7: Generate static game data JSON'
    ):
        print("\n❌ Pipeline failed at step 6")
        sys.exit(1)

    # Step 7: Fetch country flag URLs and update countries-data-map.json
    if not run_script(
        'fetch_country_flags.py',
        [version] + extra_args,
        'Step 7/7: Fetch country flag URLs from Paradox wiki'
    ):
        print("\n❌ Pipeline failed at step 7")
        sys.exit(1)
    
    # Success!
    overall_elapsed = time.time() - overall_start
    minutes = int(overall_elapsed // 60)
    seconds = int(overall_elapsed % 60)
    
    print(f"\n{'='*80}")
    print(f"✅ ALL DATA GENERATION COMPLETED SUCCESSFULLY!")
    print(f"{'='*80}")
    print(f"Version: {version}")
    print(f"Output directory: {output_dir}")
    print(f"Total time: {minutes}m {seconds}s")
    print(f"Finished at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n📂 Generated files:")
    
    # List generated files
    if os.path.exists(output_dir):
        for file in sorted(os.listdir(output_dir)):
            file_path = os.path.join(output_dir, file)
            if os.path.isfile(file_path):
                size = os.path.getsize(file_path)
                if size > 1024 * 1024:
                    size_str = f"{size / 1024 / 1024:.2f} MB"
                elif size > 1024:
                    size_str = f"{size / 1024:.1f} KB"
                else:
                    size_str = f"{size} bytes"
                print(f"  ✓ {file} ({size_str})")
    
    print()


if __name__ == '__main__':
    main()
