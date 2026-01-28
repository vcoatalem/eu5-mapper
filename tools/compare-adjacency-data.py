#!/usr/bin/env python3
"""
Script to compare two adjacency-data CSV files and show differences.

Usage: python compare-adjacency-data.py <old_file.csv> <new_file.csv> [--output <output_file.txt>]
Example: python compare-adjacency-data.py adjacency-data-old.csv adjacency-data-new.csv
         python compare-adjacency-data.py adjacency-data-old.csv adjacency-data-new.csv --output diff.txt
"""

import sys
import csv
from collections import defaultdict
from pathlib import Path


def read_adjacency_csv(filepath):
    """
    Read adjacency CSV file and return a set of tuples and a dict for fast lookup.
    Returns:
        - connections: set of (locationA, locationB, accessType) tuples
        - by_locations: dict mapping (locationA, locationB) to accessType
    """
    connections = set()
    by_locations = {}
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                loc_a = row['locationA']
                loc_b = row['locationB']
                access_type = row['accessType']
                
                connections.add((loc_a, loc_b, access_type))
                by_locations[(loc_a, loc_b)] = access_type
    except FileNotFoundError:
        print(f"Error: File '{filepath}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading file '{filepath}': {e}")
        sys.exit(1)
    
    return connections, by_locations


def count_by_type(connections):
    """Count connections by access type."""
    counts = defaultdict(int)
    for loc_a, loc_b, access_type in connections:
        counts[access_type] += 1
    return dict(counts)


def compare_adjacency_files(old_file, new_file):
    """
    Compare two adjacency CSV files and return differences.
    
    Returns:
        - added: connections in new_file but not in old_file
        - removed: connections in old_file but not in new_file
        - modified: connections where the same location pair has different access types
        - old_type_counts: count of each connection type in old file
        - new_type_counts: count of each connection type in new file
    """
    old_connections, old_by_locations = read_adjacency_csv(old_file)
    new_connections, new_by_locations = read_adjacency_csv(new_file)
    
    added = new_connections - old_connections
    removed = old_connections - new_connections
    
    # Find modified connections (same location pair, different access type)
    modified = []
    for (loc_a, loc_b) in old_by_locations:
        if (loc_a, loc_b) in new_by_locations:
            old_access = old_by_locations[(loc_a, loc_b)]
            new_access = new_by_locations[(loc_a, loc_b)]
            if old_access != new_access:
                modified.append((loc_a, loc_b, old_access, new_access))
    
    # Count connections by type
    old_type_counts = count_by_type(old_connections)
    new_type_counts = count_by_type(new_connections)
    
    return added, removed, modified, old_type_counts, new_type_counts


def format_connection(loc_a, loc_b, access_type):
    """Format a connection for display."""
    return f"{loc_a} <-> {loc_b} ({access_type})"


def print_differences(added, removed, modified, old_type_counts, new_type_counts, output_file=None):
    """
    Print differences in a clear, easy-to-process format.
    If output_file is provided, write to file instead of stdout.
    """
    output_lines = []
    
    # Header
    output_lines.append("=" * 80)
    output_lines.append("ADJACENCY DATA COMPARISON REPORT")
    output_lines.append("=" * 80)
    output_lines.append("")
    
    # Summary
    output_lines.append("SUMMARY:")
    output_lines.append(f"  Added connections:    {len(added)}")
    output_lines.append(f"  Removed connections:  {len(removed)}")
    output_lines.append(f"  Modified connections: {len(modified)}")
    output_lines.append(f"  Total changes:        {len(added) + len(removed) + len(modified)}")
    output_lines.append("")
    
    # Connection counts by type
    output_lines.append("CONNECTIONS BY TYPE:")
    output_lines.append("")
    
    # Get all access types from both files
    all_types = sorted(set(list(old_type_counts.keys()) + list(new_type_counts.keys())))
    
    # Calculate totals
    old_total = sum(old_type_counts.values())
    new_total = sum(new_type_counts.values())
    
    output_lines.append(f"  {'Type':<15} {'Old':<10} {'New':<10} {'Change':<10}")
    output_lines.append(f"  {'-'*15} {'-'*10} {'-'*10} {'-'*10}")
    
    for access_type in all_types:
        old_count = old_type_counts.get(access_type, 0)
        new_count = new_type_counts.get(access_type, 0)
        change = new_count - old_count
        change_str = f"{change:+d}" if change != 0 else "0"
        output_lines.append(f"  {access_type:<15} {old_count:<10} {new_count:<10} {change_str:<10}")
    
    output_lines.append(f"  {'-'*15} {'-'*10} {'-'*10} {'-'*10}")
    total_change = new_total - old_total
    total_change_str = f"{total_change:+d}" if total_change != 0 else "0"
    output_lines.append(f"  {'TOTAL':<15} {old_total:<10} {new_total:<10} {total_change_str:<10}")
    output_lines.append("")
    
    # Added connections
    if added:
        output_lines.append("=" * 80)
        output_lines.append(f"ADDED CONNECTIONS ({len(added)}):")
        output_lines.append("=" * 80)
        for loc_a, loc_b, access_type in sorted(added):
            output_lines.append(f"  + {format_connection(loc_a, loc_b, access_type)}")
        output_lines.append("")
    else:
        output_lines.append("No connections added.")
        output_lines.append("")
    
    # Removed connections
    if removed:
        output_lines.append("=" * 80)
        output_lines.append(f"REMOVED CONNECTIONS ({len(removed)}):")
        output_lines.append("=" * 80)
        for loc_a, loc_b, access_type in sorted(removed):
            output_lines.append(f"  - {format_connection(loc_a, loc_b, access_type)}")
        output_lines.append("")
    else:
        output_lines.append("No connections removed.")
        output_lines.append("")
    
    # Modified connections
    if modified:
        output_lines.append("=" * 80)
        output_lines.append(f"MODIFIED CONNECTIONS ({len(modified)}):")
        output_lines.append("=" * 80)
        for loc_a, loc_b, old_access, new_access in sorted(modified):
            output_lines.append(f"  ~ {loc_a} <-> {loc_b}")
            output_lines.append(f"      OLD: {old_access}")
            output_lines.append(f"      NEW: {new_access}")
        output_lines.append("")
    else:
        output_lines.append("No connections modified.")
        output_lines.append("")
    
    # Group changes by location for easier analysis
    output_lines.append("=" * 80)
    output_lines.append("CHANGES BY LOCATION:")
    output_lines.append("=" * 80)
    
    location_changes = defaultdict(lambda: {'added': [], 'removed': [], 'modified': []})
    
    for loc_a, loc_b, access_type in added:
        location_changes[loc_a]['added'].append((loc_b, access_type))
        location_changes[loc_b]['added'].append((loc_a, access_type))
    
    for loc_a, loc_b, access_type in removed:
        location_changes[loc_a]['removed'].append((loc_b, access_type))
        location_changes[loc_b]['removed'].append((loc_a, access_type))
    
    for loc_a, loc_b, old_access, new_access in modified:
        location_changes[loc_a]['modified'].append((loc_b, old_access, new_access))
        location_changes[loc_b]['modified'].append((loc_a, old_access, new_access))
    
    # Sort locations by number of changes (most affected first)
    sorted_locations = sorted(
        location_changes.items(),
        key=lambda x: len(x[1]['added']) + len(x[1]['removed']) + len(x[1]['modified']),
        reverse=True
    )
    
    for location, changes in sorted_locations:
        total_changes = len(changes['added']) + len(changes['removed']) + len(changes['modified'])
        output_lines.append(f"\n{location} ({total_changes} changes):")
        
        if changes['added']:
            output_lines.append(f"  Added ({len(changes['added'])}):")
            for other_loc, access_type in sorted(set(changes['added'])):
                output_lines.append(f"    + {other_loc} ({access_type})")
        
        if changes['removed']:
            output_lines.append(f"  Removed ({len(changes['removed'])}):")
            for other_loc, access_type in sorted(set(changes['removed'])):
                output_lines.append(f"    - {other_loc} ({access_type})")
        
        if changes['modified']:
            output_lines.append(f"  Modified ({len(changes['modified'])}):")
            for other_loc, old_access, new_access in sorted(set(changes['modified'])):
                output_lines.append(f"    ~ {other_loc}: {old_access} -> {new_access}")
    
    output_lines.append("")
    output_lines.append("=" * 80)
    output_lines.append("END OF REPORT")
    output_lines.append("=" * 80)
    
    # Output to file or stdout
    output_text = "\n".join(output_lines)
    
    if output_file:
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output_text)
            print(f"Comparison report written to: {output_file}")
        except Exception as e:
            print(f"Error writing to file '{output_file}': {e}")
            print("\nPrinting to console instead:\n")
            print(output_text)
    else:
        print(output_text)


def main():
    """Main function."""
    if len(sys.argv) < 3:
        print("Usage: python compare-adjacency-data.py <old_file.csv> <new_file.csv> [--output <output_file.txt>]")
        print("\nExample:")
        print("  python compare-adjacency-data.py adjacency-data-old.csv adjacency-data-new.csv")
        print("  python compare-adjacency-data.py adjacency-data-old.csv adjacency-data-new.csv --output diff.txt")
        sys.exit(1)
    
    old_file = sys.argv[1]
    new_file = sys.argv[2]
    
    # Check for optional output file argument
    output_file = None
    if len(sys.argv) >= 5 and sys.argv[3] == '--output':
        output_file = sys.argv[4]
    
    # Verify files exist
    if not Path(old_file).exists():
        print(f"Error: Old file '{old_file}' does not exist.")
        sys.exit(1)
    
    if not Path(new_file).exists():
        print(f"Error: New file '{new_file}' does not exist.")
        sys.exit(1)
    
    # Perform comparison
    print(f"Comparing:\n  OLD: {old_file}\n  NEW: {new_file}\n")
    added, removed, modified, old_type_counts, new_type_counts = compare_adjacency_files(old_file, new_file)
    
    # Print results
    print_differences(added, removed, modified, old_type_counts, new_type_counts, output_file)


if __name__ == "__main__":
    main()
