"use server";

import { ReactNode } from "react";
import { readFile } from "fs/promises";
import { join } from "path";
import { ILocationDataMap } from "./lib/types";
import { GameDataClientProvider } from "./gameDataContext";
import { GameDataParser } from "./lib/gameDataParser";

interface GameDataProviderProps {
  children: ReactNode;
  locationNameColorPath?: string;
  locationDataPath?: string;
  mapConfigPath?: string;
}

export async function GameDataProvider({
  children,
  locationNameColorPath = "game_data/locations_color_mapping/0.0.11/00_default.txt",
  locationDataPath = "game_data/world_map/0.0.11/location_templates.txt",
  mapConfigPath = "game_data/world_map/0.0.11/default.map",
}: GameDataProviderProps) {
  let locationDataMap: ILocationDataMap | null = {};
  let error: string | null = null;

  try {
    const [
      { colorToName, nameToColor },
      locationData,
      { nonOwnable, impassableMountains },
    ] = await Promise.all([
      (async () => {
        const locationNameColorFilePath = join(
          process.cwd(),
          locationNameColorPath
        );
        const locationNameColorFileContent = await readFile(
          locationNameColorFilePath,
          "utf-8"
        );

        return GameDataParser.parseLocationNameAndColorHex(
          locationNameColorFileContent
        );
      })(),
      (async () => {
        const locationDataFilePath = join(process.cwd(), locationDataPath);
        const locationDataFileContent = await readFile(
          locationDataFilePath,
          "utf-8"
        );

        return GameDataParser.parseLocationData(locationDataFileContent);
      })(),
      (async () => {
        const mapConfigFilePath = join(process.cwd(), mapConfigPath);
        const mapConfigFileContent = await readFile(mapConfigFilePath, "utf-8");

        return GameDataParser.parseMapConfig(mapConfigFileContent);
      })(),
    ]);

    for (const [locationName, data] of Object.entries(locationData)) {
      const hexColor = nameToColor[locationName];
      const isNonOwnable = nonOwnable.has(locationName);
      const isImpassableMountain = impassableMountains.has(locationName);
      const isLake = data.topography === "lakes";
      const isSea =
        data.topography === "ocean" ||
        data.topography === "coastal_ocean" ||
        data.topography === "inland_sea" ||
        data.topography === "ocean_wasteland" ||
        data.topography === "narrows";

      locationDataMap[hexColor] = {
        ...data,
        name: locationName,
        isLake,
        isSea,
        ownable: !isNonOwnable && !isImpassableMountain && !isLake && !isSea,
      };
    }

    if (!locationDataMap) {
      locationDataMap = null;
      throw new Error("Failed to load game data");
    }
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Unknown error loading game data";
    console.error("[GameDataProvider] Error loading data:", error);
  }

  return (
    <GameDataClientProvider value={{ locationDataMap, error }}>
      {children}
    </GameDataClientProvider>
  );
}
