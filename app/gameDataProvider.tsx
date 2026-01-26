"use server";

import { ReactNode } from "react";
import { readFile } from "fs/promises";
import { join } from "path";
import { ILocationDataMap, ILocationIdentifierMap } from "./lib/types";
import { GameDataClientProvider } from "./gameDataContext";
import { GameDataParser } from "./lib/gameDataParser";
import { GameDataLoader } from "./lib/gameDataLoader";

interface GameDataProviderProps {
  children: ReactNode;
  /*   locationNameColorPath?: string;
  locationDataPath?: string;
  locationsDataPath?: string; */
}

export async function GameDataProvider({
  children,
}: /*   locationNameColorPath = "game_data/locations_color_mapping/0.0.11/00_default.txt",
  locationDataPath = "game_data/world_map/0.0.11/location_templates.txt",
  locationsDataPath: mapConfigPath = "game_data/world_map/0.0.11/default.map", */
GameDataProviderProps) {
  let locationDataMap: ILocationDataMap = {};
  let colorToNameMap: ILocationIdentifierMap = {};
  let error: string | null = null;

  const files = await GameDataLoader.getGameFilesForVersion("0.0.11");

  try {
    const [
      { colorToName, nameToColor },
      locationData,
      { nonOwnable, impassableMountains },
    ] = await Promise.all([
      (async () => {
        const locationNameColorFileContent = await readFile(
          files.locationsColorMappingFilePath,
          "utf-8"
        );

        return GameDataParser.parseLocationNameAndColorHex(
          locationNameColorFileContent
        );
      })(),
      (async () => {
        const locationDataFileContent = await readFile(
          files.locationDataFilePath,
          "utf-8"
        );

        return GameDataParser.parseLocationData(locationDataFileContent);
      })(),
      (async () => {
        const mapConfigFileContent = await readFile(
          files.provincesDataFilePath,
          "utf-8"
        );

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

      if (locationDataMap[locationName]) {
        console.warn(
          `[GameDataProvider] Duplicate location name found: ${locationName}`
        );
      }

      locationDataMap[locationName] = {
        ...data,
        name: locationName,
        hexColor: hexColor,
        isLake,
        isSea,
        ownable: !isNonOwnable && !isImpassableMountain && !isLake && !isSea,
      };
      colorToNameMap = colorToName;
    }

    if (!locationDataMap) {
      throw new Error("Failed to load game data");
    }
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Unknown error loading game data";
    console.error("[GameDataProvider] Error loading data:", error);
  }

  return (
    <GameDataClientProvider value={{ locationDataMap, colorToNameMap, error }}>
      {children}
    </GameDataClientProvider>
  );
}
