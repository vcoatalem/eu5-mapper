import { z } from "zod";

/**
 * All file types that need to be loaded by the application
 * These are the logical names for files, mapped to their actual file names
 */
export type GameDataFileType =
  | "locationData"
  | "buildingsTemplate"
  | "adjacencyCsv"
  | "proximityComputationRule"
  | "countriesData"
  | "roads"
  | "locationsImage"
  | "borderLayer"
  | "terrainLayer"
  | "countryModifiersTemplate";

/**
 * Keys present in per-version manifest.json produced by data pipeline.
 */
export const ZodVersionManifestFileKey = z.enum([
  "locations_data",
  "building_templates",
  "refined_adjacency_csv",
  "proximity_rules",
  "country_data",
  "roads",
  "location_image",
  "border_image",
  "terrain_image",
  "country_modifiers_templates",
]);

export type VersionManifestFileKey = z.infer<typeof ZodVersionManifestFileKey>;

export const FILE_TYPE_TO_MANIFEST_KEY: Record<
  GameDataFileType,
  VersionManifestFileKey
> = {
  locationData: "locations_data",
  buildingsTemplate: "building_templates",
  adjacencyCsv: "refined_adjacency_csv",
  proximityComputationRule: "proximity_rules",
  countriesData: "country_data",
  roads: "roads",
  locationsImage: "location_image",
  borderLayer: "border_image",
  terrainLayer: "terrain_image",
  countryModifiersTemplate: "country_modifiers_templates",
} as const;

export const ZodVersionManifestEntry = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  compressed: z.boolean(),
});

export type VersionManifestEntry = z.infer<typeof ZodVersionManifestEntry>;

const versionManifestShape = Object.fromEntries(
  ZodVersionManifestFileKey.options.map((key) => [
    key,
    ZodVersionManifestEntry,
  ]),
) as Record<VersionManifestFileKey, typeof ZodVersionManifestEntry>;

export const ZodVersionManifest = z.object(versionManifestShape);

export type VersionManifest = z.infer<typeof ZodVersionManifest>;
