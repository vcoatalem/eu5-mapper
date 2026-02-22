/**
 * Shared types for versions manifest
 * Used by both the manifest generator script and the version resolver
 */

/**
 * File path information for a specific version
 */
export interface FileVersionInfo {
  path: string;
}

/**
 * Manifest entry for a single file type
 * Keys are version strings (e.g., "0.0.11", "0.1.0")
 * If a version doesn't exist for this file, the key is simply omitted
 */
export interface FileManifest {
  [version: string]: FileVersionInfo;
}

/**
 * All file types that need to be loaded by the application
 * These are the logical names for files, mapped to their actual file names
 */
export type GameDataFileType =
  | "locationDataMap" // location-data-map.json
  | "colorToNameMap" // color-to-name-map.json
  | "buildingsTemplate" // buildings-template.json
  | "adjacencyCsv" // adjacency-data.csv
  | "proximityComputationRule" // proximity-calculation-rules.json
  | "countriesDataMap" // countries-data-map.json
  | "roads" // roads.json
  | "locationsImage" // images/locations.png
  | "borderLayer" // images/border_layer.png
  | "terrainLayer" // images/terrain_layer.png
  | "countryProximityBuffsTemplate"; // buffs-template.json

/**
 * Mapping from logical file type names to actual file names/paths
 */
export const FILE_TYPE_TO_FILENAME: Record<GameDataFileType, string> = {
  locationDataMap: "location-data-map.json",
  colorToNameMap: "color-to-name-map.json",
  buildingsTemplate: "buildings-template.json",
  adjacencyCsv: "adjacency-data.csv",
  proximityComputationRule: "proximity-calculation-rules.json",
  countriesDataMap: "countries-data-map.json",
  roads: "roads.json",
  locationsImage: "images/locations.png",
  borderLayer: "images/border_layer.png",
  terrainLayer: "images/terrain_layer.png",
  countryProximityBuffsTemplate: "buffs-template.json",
} as const;

/**
 * Complete versions manifest structure
 * The files record is keyed by logical file type names
 */
export interface VersionsManifest {
  versions: string[];
  files: Record<GameDataFileType, FileManifest>;
}
