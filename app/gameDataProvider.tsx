"use server";

import { ReactNode } from "react";
import { readFile } from "fs/promises";
import {
  ILocationDataMap,
  ILocationIdentifierMap,
  IBuildingTemplate,
} from "./lib/types";
import { GameDataClientProvider } from "./gameDataContext";
import { GameDataParser } from "./lib/gameDataParser";
import { GameDataLoader } from "./lib/gameDataLoader";

interface GameDataProviderProps {
  children: ReactNode;
}

export async function GameDataProvider({ children }: GameDataProviderProps) {
  let locationDataMap: ILocationDataMap = {};
  let colorToNameMap: ILocationIdentifierMap = {};
  let buildingsTemplateMap: Record<string, IBuildingTemplate> = {};
  let error: string | null = null;

  const files = await GameDataLoader.getGameFilesForVersion("0.0.11");

  try {
    const [
      { colorToName, nameToColor },
      locationData,
      { nonOwnable, impassableMountains },
      hierarchy,
      cityCoordinates,
      buildingsData,
    ] = await Promise.all([
      readFile(files.locationsColorMappingFilePath, "utf-8").then((content) =>
        GameDataParser.parseLocationNameAndColorHex(content)
      ),
      readFile(files.locationDataFilePath, "utf-8").then((content) =>
        GameDataParser.parseLocationData(content)
      ),

      readFile(files.locationClassificationFilePath, "utf-8").then((content) =>
        GameDataParser.parseMapConfig(content)
      ),
      readFile(files.provincesDataFilePath, "utf-8").then((content) =>
        GameDataParser.parseLocationHierarchy(content)
      ),

      readFile(files.locationsCityCoordinatesMapFilePath, "utf-8").then(
        (content) => GameDataParser.parseCityCoordinates(content)
      ),

      readFile(files.buildingsDataFilePath, "utf-8").then(
        (content) => JSON.parse(content) as Array<IBuildingTemplate>
      ),
    ]);

    buildingsTemplateMap = buildingsData.reduce((acc, building) => {
      acc[building.name] = building;
      return acc;
    }, {} as Record<string, IBuildingTemplate>);

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
        hierarchy: hierarchy[locationName],
        constructibleLocationCoordinate: cityCoordinates[locationName],
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
    <GameDataClientProvider
      value={{ locationDataMap, colorToNameMap, buildingsTemplateMap, error }}
    >
      {children}
    </GameDataClientProvider>
  );
}
