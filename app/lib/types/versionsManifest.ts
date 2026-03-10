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
 * Keys are version strings (e.g., "1.0.11", "1.1.4")
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
  | "locationData" // location-data.json
  | "buildingsTemplate" // buildings-template.json
  | "adjacencyCsv" // adjacency-data.csv
  | "proximityComputationRule" // proximity-calculation-rules.json
  | "countriesData" // countries-data.json
  | "roads" // roads.json
  | "locationsImage" // images/locations.png
  | "borderLayer" // images/border_layer.png
  | "terrainLayer" // images/terrain_layer.png
  | "countryModifiersTemplate"; // country-modifiers-templates.json

/**
 * Mapping from logical file type names to actual file names/paths
 */
export const FILE_TYPE_TO_FILENAME: Record<GameDataFileType, string> = {
  locationData: "location-data.json",
  buildingsTemplate: "buildings-template.json",
  adjacencyCsv: "adjacency-data.csv",
  proximityComputationRule: "proximity-calculation-rules.json",
  countriesData: "countries-data.json",
  roads: "roads.json",
  locationsImage: "images/locations.png",
  borderLayer: "images/border_layer.png",
  terrainLayer: "images/terrain_layer.png",
  countryModifiersTemplate: "country-modifiers-templates.json",
} as const;

/**
 * Complete versions manifest structure
 * The files record is keyed by logical file type names
 */
export interface VersionsManifest {
  versions: string[];
  files: Record<GameDataFileType, FileManifest>;
}
