/**
 * Maps building names to their corresponding image paths in the public directory.
 * Images are located in /public/gui/buildings/
 */
export const BUILDINGS_IMAGE_MAP: Record<string, string> = {
  bridge: "/gui/buildings/bridge.png",
  canal: "/gui/buildings/canal.png",
  dock: "/gui/buildings/dock.png",
  wharf: "/gui/buildings/wharf.png",
  "protected harbor": "/gui/buildings/protected_harbor.png",
  "fishing village": "/gui/buildings/fishing_village.png",
  bailiff: "/gui/buildings/bailiff.png",
} as const;

/**
 * Gets the image path for a building by name.
 * Returns undefined if the building has no associated image.
 * Logs a warning if the building is not found in the map.
 */
export function getBuildingImage(buildingName: string): string | undefined {
  const imagePath = BUILDINGS_IMAGE_MAP[buildingName];

  if (!imagePath) {
    console.warn(
      `[buildingsImageMap] No image found for building: "${buildingName}". Available buildings:`,
      Object.keys(BUILDINGS_IMAGE_MAP),
    );
    return undefined;
  }

  return imagePath;
}
