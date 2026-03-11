import { GAME_DATA_VERSIONS } from "@/app/config/gameData.config";

export type GAME_DATA_VERSION = (typeof GAME_DATA_VERSIONS)[number];

export const isValidVersion = (
  version: string,
): version is GAME_DATA_VERSION => {
  return GAME_DATA_VERSIONS.includes(version as GAME_DATA_VERSION);
};
