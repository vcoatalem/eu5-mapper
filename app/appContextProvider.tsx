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
import { VersionResolver } from "./lib/versionResolver";
import {
  GameDataFileType,
  FILE_TYPE_TO_FILENAME,
} from "./lib/types/versionsManifest";

interface IImagePaths {
  locationsImage: string;
  borderLayer: string;
  terrainLayer: string;
}

interface IAppContext {
  gameData: IGameData | null;
  imagePaths: IImagePaths | null;
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
  const [imagePaths, setImagePaths] = useState<IImagePaths | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGameData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`[AppContext] Loading game data for version ${version}...`);

        // Initialize version resolver and load manifest once
        const versionResolver = new VersionResolver();
        await versionResolver.loadVersionsManifest();

        // Resolve and preload map images with version resolution
        const resolveAndPreloadImages = async (): Promise<IImagePaths> => {
          const imageFileTypes: GameDataFileType[] = [
            'locationsImage',
            'borderLayer',
            'terrainLayer',
          ];

          const imagePathsEntries = await Promise.all(
            imageFileTypes.map(async (fileType) => {
              const resolvedVersion = await versionResolver.resolveFileVersion(
                fileType,
                version
              );
              const imagePath = versionResolver.getFilePath(fileType, resolvedVersion);
              
              // Preload the image
              await new Promise<void>((resolve, reject) => {
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

              return [fileType, imagePath] as const;
            })
          );

          // Build IImagePaths object with proper typing
          const imagePaths: IImagePaths = {
            locationsImage: '',
            borderLayer: '',
            terrainLayer: '',
          };
          
          for (const [fileType, path] of imagePathsEntries) {
            if (fileType === 'locationsImage' || fileType === 'borderLayer' || fileType === 'terrainLayer') {
              imagePaths[fileType] = path;
            }
          }
          
          return imagePaths;
        };

        const preloadGameDataFiles = async () => {
          const gameDataFileTypes: GameDataFileType[] = [
            'locationDataMap',
            'colorToNameMap',
            'buildingsTemplateMap',
            'adjacencyCsv',
            'proximityComputationRule',
            'countriesDataMap',
            'roads',
          ];

          const entries = await Promise.all(
            gameDataFileTypes.map(async (fileType) => {
              try {
                // Resolve version for this file
                const resolvedVersion = await versionResolver.resolveFileVersion(
                  fileType,
                  version
                );
                const filePath = versionResolver.getFilePath(fileType, resolvedVersion);
                const fileName = FILE_TYPE_TO_FILENAME[fileType];

                // Fetch and parse the file
                const res = await fetch(filePath);
                if (!res.ok) {
                  throw new Error(`could not fetch ${fileType}: ${res.status}`);
                }

                if (fileName.endsWith('.json')) {
                  const data = await res.json();
                  return [fileType, data] as const;
                } else if (fileName.endsWith('.csv')) {
                  const data = await res.text();
                  return [fileType, data] as const;
                } else {
                  throw new Error(`Unsupported file type: ${fileName}`);
                }
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                throw new Error(`Failed to preload game data file ${fileType}: ${errorMsg}`);
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
        };

        const [gameDataFiles, resolvedImagePaths] = await Promise.all([
          preloadGameDataFiles(),
          resolveAndPreloadImages(),
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
        setImagePaths(resolvedImagePaths);
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
        imagePaths,
        isLoading,
        error,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
