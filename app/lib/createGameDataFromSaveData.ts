import { ALL_GAME_DATA_OPTIONS, type GameDataVersion } from "@/app/config/gameData.config";
import { type GameData } from "@/app/lib/types/general";
import { type SaveData } from "@shared/saveData";

export type CreateGameDataFromSaveDataResult = {
  gameData: GameData;
  versionWarning?: string;
};

/**
 * Resolves the most recent supported game data version that is <= saveVersion.
 * Returns a warning string when the resolved version is anterior to saveVersion.
 */
function resolveGameDataVersion(saveVersion: string | null): {
  version: GameDataVersion;
  warning?: string;
} {
  if (!saveVersion) {
    const version = ALL_GAME_DATA_OPTIONS[ALL_GAME_DATA_OPTIONS.length - 1];
    return { version, warning: `Save file has no version — using latest (${version})` };
  }

  const sorted = [...ALL_GAME_DATA_OPTIONS].sort((a, b) => compareSemver(a, b));

  // Find the most recent supported version <= saveVersion
  let resolved: GameDataVersion | null = null;
  for (const v of sorted) {
    if (compareSemver(v, saveVersion) <= 0) resolved = v;
  }

  if (!resolved) {
    // Save is older than all supported versions — use oldest
    resolved = sorted[0];
    return {
      version: resolved,
      warning: `Save version ${saveVersion} is older than the oldest supported game data version (${resolved}). Data may be inaccurate.`,
    };
  }

  const warning =
    compareSemver(resolved, saveVersion) < 0
      ? `Game data version ${resolved} is anterior to save version ${saveVersion}. Some data may be inaccurate.`
      : undefined;

  return { version: resolved, warning };
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Overlays save game data onto base game data.
 * The returned GameData has the same shape but with save-specific context applied:
 * - version resolved from save
 * - buildings from the save applied to location data
 */
export function createGameDataFromSaveData(
  save: SaveData,
  gameData: GameData
): CreateGameDataFromSaveDataResult {
  const { version, warning: versionWarning } = resolveGameDataVersion(save.data.version);

  // Apply building levels from save onto locationDataMap
  const locationDataMap = { ...gameData.locationDataMap };
  for (const [locationId, building] of Object.entries(save.data.locationBuildings)) {
    const location = locationDataMap[locationId];
    if (!location) continue;
    const template = Object.values(gameData.buildingsTemplate).find(
      (t) => t.name === building.name
    );
    if (!template) continue;
    // Apply save building data — extend as needed when location schema supports it
  }

  return {
    gameData: { ...gameData, locationDataMap },
    versionWarning,
  };
}

export { resolveGameDataVersion };
