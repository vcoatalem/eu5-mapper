/**
 * Maps entity names to their corresponding image paths in the public directory.
 * Images are located in /public/gui/buildings/ and /public/gui/icons/
 */
export const NAMED_GUI_IMAGES_MAP: Record<string, string> = {
  // Icons
  city: "/gui/icons/city.png",
  town: "/gui/icons/town.png",
  rural: "/gui/icons/rural.png",
  gravel_road: "/gui/icons/gravel_road.png",
  modern_road: "/gui/icons/modern_road.png",
  paved_road: "/gui/icons/paved_road.png",
  rail_road: "/gui/icons/railroad.png",
} as const;

/**
 * Gets the image path for an entity by name.
 * Returns undefined if the entity has no associated image.
 * Logs a warning if the entity is not found in the map.
 */
export function getGuiImage(name: string): string | undefined {
  const imagePath = NAMED_GUI_IMAGES_MAP[name];

  if (!imagePath) {
    console.warn(
      `[namedGuiImagesMap] No image found for: "${name}". Available entries:`,
      Object.keys(NAMED_GUI_IMAGES_MAP),
    );
    return undefined;
  }

  return imagePath;
}
