"""
GameDataLoader for Python - manages game data file paths across versions
"""

import os
import re
from typing import Dict, List, Optional
from dataclasses import dataclass

GameVersion = str  # e.g., "0.0.11"


@dataclass
class GameDataFiles:
    """Paths to game data files for a specific version"""
    locations_map: str
    rivers_map: str
    color_mapping: str
    default_map: str
    ports_file: str
    location_classification: str
    location_data: str
    provinces_data: str
    locations_color_mapping: str
    locations_city_coordinates: str
    buildings_data: str


class GameDataLoader:
    """
    Loads game data files for a specific version, with fallback to closest previous version.
    Similar to the TypeScript GameDataLoader class.
    """
    
    BASE_FOLDER_NAMES = {
        'locations_map': 'world_map',
        'rivers_map': 'river_map',
        'color_mapping': 'locations_color_mapping',
        'default_map': 'locations_classification',
        'ports_file': 'ports',
        'location_classification': 'locations_classification',
        'location_data': 'locations_data',
        'provinces_data': 'provinces_data',
        'locations_color_mapping': 'locations_color_mapping',
        'locations_city_coordinates': 'locations_city_coordinates',
        'buildings_data': 'buildings_data',
    }
    
    FILE_NAMES = {
        'locations_map': 'locations.png',
        'rivers_map': 'rivers.png',
        'color_mapping': '00_default.txt',
        'default_map': 'default.map',
        'ports_file': 'ports.csv',
        'location_classification': 'default.map',
        'location_data': 'location_templates.txt',
        'provinces_data': 'definitions.txt',
        'locations_color_mapping': '00_default.txt',
        'locations_city_coordinates': 'generated_map_object_locators_city.txt',
        'buildings_data': 'buildings.json',
    }
    
    def __init__(self, folder_path: Optional[str] = None):
        """
        Initialize the loader.
        
        Args:
            folder_path: Root path to game_data folder. If None, uses parent directory of cwd + 'game_data'
        """
        if folder_path is None:
            # Go up one directory from tools/ to project root, then into game_data
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(script_dir)
            self.folder_path = os.path.join(project_root, 'game_data')
        else:
            self.folder_path = folder_path
    
    @staticmethod
    def get_closest_version(available_versions: List[str], target_version: GameVersion) -> str:
        """
        Get the target version if found, or the closest previous version.
        
        Args:
            available_versions: List of available semver versions (e.g., ["0.0.11", "0.1.0"])
            target_version: The desired version
            
        Returns:
            The matching or closest previous version
            
        Raises:
            ValueError: If no suitable version is found
        """
        if target_version in available_versions:
            return target_version
        
        closest_match = None
        
        for version in available_versions:
            # Validate semver format
            if not re.match(r'[0-9]+\.[0-9]+\.[0-9]+', version):
                continue
            
            # We count on semver versions being alphabetically ordered
            if version < target_version:
                if closest_match is None or version > closest_match:
                    closest_match = version
        
        if closest_match is None:
            raise ValueError(
                f"Could not find any suitable version for target version {target_version}"
            )
        
        return closest_match
    
    def get_game_files_for_version(self, version: GameVersion) -> GameDataFiles:
        """
        Get all game data file paths for a specific version.
        
        Args:
            version: The game version to load (e.g., "0.0.11")
            
        Returns:
            GameDataFiles object with all file paths
            
        Raises:
            FileNotFoundError: If required directories or files don't exist
            ValueError: If no suitable version is found
        """
        game_files = {}
        
        for key, base_folder_name in self.BASE_FOLDER_NAMES.items():
            folder_path = os.path.join(self.folder_path, base_folder_name)
            
            if not os.path.exists(folder_path):
                raise FileNotFoundError(f"Game data folder not found: {folder_path}")
            
            # Get available versions in this folder
            versions_available = [
                d for d in os.listdir(folder_path)
                if os.path.isdir(os.path.join(folder_path, d))
            ]
            
            if not versions_available:
                raise FileNotFoundError(f"No versions found in {folder_path}")
            
            # Find the closest version
            found_version = self.get_closest_version(versions_available, version)
            
            # Construct the file path
            file_name = self.FILE_NAMES[key]
            file_path = os.path.join(folder_path, found_version, file_name)
            
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Expected file not found: {file_path}")
            
            game_files[key] = file_path
        
        return GameDataFiles(**game_files)
