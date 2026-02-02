"use client";

import {
  useState,
  useEffect,
  createContext,
} from "react";
import { useParams } from "next/navigation";
import {
  IGameData,
  ILocationDataMap,
  ILocationIdentifierMap,
  IBuildingTemplate,
  ICountryData,
} from "./lib/types/general";
import { IProximityComputationRule } from "./lib/types/proximityComputationRules";
import { IndexedDBWriter } from "./lib/indexeddb/indexeddb-writer";
import {
  dbAdjacencyDataStoreName,
  dbDataKey,
  dbGameDataStoreName,
  dbName,
  dbStoreNames,
  dbVersion,
} from "./lib/indexeddb/indexeddb.const";
import { ParserHelper } from "./lib/parser.helper";
import { worldMapConfig } from "./components/worldMap.config";

interface IAppContext {
  gameData: IGameData | null;
  isLoading: boolean;
  error: string | null;
}

const emptyContext = {} as IAppContext;

export const AppContext = createContext<IAppContext>(emptyContext);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const params = useParams();
  const version = params?.version as string;

  // Game data state
  const [gameData, setGameData] = useState<IGameData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGameData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`[AppContext] Loading game data for version ${version}...`);

        const basePath = `/${version}/game_data`;

        // Preload map images in parallel with data fetches
        const preloadImages = () => {
          const imagePaths = [
            worldMapConfig.colorMapFileName,
            worldMapConfig.borderMapFileName,
            worldMapConfig.terrainLayerFileName,
          ];

          return Promise.all(
            imagePaths.map((imagePath) => {
              return new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                  console.log(`[AppContext] Preloaded image: ${imagePath}`);
                  resolve();
                };
                img.onerror = (e) => {
                  const error = new Error(`Failed to preload image: ${imagePath}`);
                  console.error(`[AppContext] ${error.message}`, e);
                  reject(error);
                };
                img.src = imagePath;
              });
            })
          );
        };

        const preloadGameDataFiles = async () => {
          const gameDataFiles = {
            locationDataMap: `${basePath}/location-data-map.json`,
            colorToNameMap: `${basePath}/color-to-name-map.json`,
            buildingsTemplateMap: `${basePath}/buildings-template-map.json`,
            adjacencyCsv: `${basePath}/adjacency-data.csv`,
            proximityComputationRule: `${basePath}/proximity-calculation-rules.json`,
            countriesDataMap: `${basePath}/countries-data-map.json`,
            roads: `${basePath}/roads.json`,
          };

          const entries = await Promise.all(
            Object.entries(gameDataFiles).map(async ([key, filePath]) => {
              try {
                const res = await fetch(filePath);
                if (!res.ok) {
                  throw new Error(`could not fetch ${key}: ${res.status}`);
                }

                if (filePath.endsWith('.json')) {
                  const data = await res.json();
                  return [key, data] as const;
                } else if (filePath.endsWith('.csv')) {
                  const data = await res.text();
                  return [key, data] as const;
                } else {
                  throw new Error(`Unsupported file type: ${filePath}`);
                }
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                throw new Error(`Failed to preload game data file ${key}: ${errorMsg}`);
              }
            })
          );

          return Object.fromEntries(entries) as {
            locationDataMap: ILocationDataMap;
            colorToNameMap: ILocationIdentifierMap;
            buildingsTemplateMap: Record<string, IBuildingTemplate>;
            adjacencyCsv: string;
            proximityComputationRule: IProximityComputationRule;
            countriesDataMap: Record<string, ICountryData>;
            roads: unknown; // Raw JSON, will be parsed by ParserHelper.parseRoadFile
          };
        }

        const [gameDataFiles] = await Promise.all([
          preloadGameDataFiles(),
          preloadImages(),
        ]);

        const {
          locationDataMap,
          colorToNameMap,
          buildingsTemplateMap,
          adjacencyCsv,
          proximityComputationRule,
          countriesDataMap,
          roads: roadsJson,
        } = gameDataFiles;

        const roads = ParserHelper.parseRoadFile(roadsJson);
        console.log("[AppContext] Parsed roads:", roads);

        const toBePersistedGameData: IGameData = {
          locationDataMap,
          colorToNameMap: {},
          buildingsTemplateMap: {},
          proximityComputationRule,
          countriesDataMap: {},
          roads,
        };
        const indexedDBWriter = new IndexedDBWriter(
          dbName,
          dbVersion,
          dbStoreNames,
        );

        console.log("clear previous indexeddb data");
        await Promise.all([
          indexedDBWriter.clearStore(dbGameDataStoreName),
          indexedDBWriter.clearStore(dbAdjacencyDataStoreName),
        ]);

        console.log("fill indexeddb");
        await indexedDBWriter
          .put(dbGameDataStoreName, dbDataKey, toBePersistedGameData)
          .then(
            () => console.log("persisted game data to indexedDB"),
            (err) =>
              console.error("could not persist game data to indexedDB", err),
          );

        await indexedDBWriter
          .put(dbAdjacencyDataStoreName, dbDataKey, adjacencyCsv)
          .then(
            () => console.log("persisted adjacency data to indexedDB"),
            (err) =>
              console.error(
                "could not persist adjacency data to indexedDB",
                err,
              ),
          );

        // indexedDB operations have to be done before setGameData to ensure this happens before worldmap component initializes
        setGameData({
          locationDataMap,
          colorToNameMap,
          buildingsTemplateMap,
          proximityComputationRule,
          countriesDataMap,
          roads,
        });

        console.log(
          `[AppContext] Game data loaded: ${Object.keys(locationDataMap).length} locations`,
        );
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to load game data";
        setError(errorMsg);
        console.error("[AppContext] Error loading game data:", errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadGameData();
  }, [version]);

  return (
    <AppContext.Provider
      value={{
        gameData,
        isLoading,
        error,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
