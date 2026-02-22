"use client";

import { GameDataLoaderHelper } from "@/app/lib/gameDataLoader.helper";
import { useParams } from "next/navigation";
import { createContext, useEffect, useState } from "react";
import { IndexedDBWriter } from "./lib/indexeddb/indexeddb-writer";
import {
  dbAdjacencyDataStoreName,
  dbDataKey,
  dbGameDataStoreName,
  dbName,
  dbStoreNames,
  dbVersion,
} from "./lib/indexeddb/indexeddb.const";
import { IGameData } from "./lib/types/general";
import { GameDataFileType } from "./lib/types/versionsManifest";
import { VersionResolver } from "./lib/versionResolver";

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
        const versionResolver = new VersionResolver();
        await versionResolver.loadVersionsManifest();
        const resolveAndPreloadImages = async (): Promise<IImagePaths> => {
          const imageFileTypes: GameDataFileType[] = [
            "locationsImage",
            "borderLayer",
            "terrainLayer",
          ];

          const imagePathsEntries = await Promise.all(
            imageFileTypes.map(async (fileType) => {
              const resolvedVersion = await versionResolver.resolveFileVersion(
                fileType,
                version,
              );
              const imagePath = versionResolver.getFilePath(
                fileType,
                resolvedVersion,
              );

              await new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                  console.log(`[AppContext] Preloaded image: ${imagePath}`);
                  resolve();
                };
                img.onerror = (e) => {
                  const error = new Error(
                    `Failed to preload image: ${imagePath}`,
                  );
                  console.error(`[AppContext] ${error.message}`, e);
                  reject(error);
                };
                img.src = imagePath;
              });

              return [fileType, imagePath] as const;
            }),
          );

          // Build IImagePaths object with proper typing
          const imagePaths: IImagePaths = {
            locationsImage: "",
            borderLayer: "",
            terrainLayer: "",
          };

          for (const [fileType, path] of imagePathsEntries) {
            if (
              fileType === "locationsImage" ||
              fileType === "borderLayer" ||
              fileType === "terrainLayer"
            ) {
              imagePaths[fileType] = path;
            }
          }

          return imagePaths;
        };

        const [gameDataFiles, resolvedImagePaths] = await Promise.all([
          GameDataLoaderHelper.loadGameDataFilesForVersion(
            version,
            versionResolver,
          ),
          resolveAndPreloadImages(),
        ]);

        const {
          locationDataMap,
          colorToNameMap,
          buildingsTemplate,
          adjacencyCsv,
          proximityComputationRule,
          countriesDataMap,
          countryProximityBuffsTemplate,
          roads,
        } = gameDataFiles;

        console.log("[AppContext] Parsed roads:", roads);

        const toBePersistedGameData: IGameData = {
          locationDataMap,
          colorToNameMap: {},
          buildingsTemplate: {},
          proximityComputationRule,
          countriesDataMap: {},
          roads,
          countryModifiersTemplate: {},
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
          buildingsTemplate,
          proximityComputationRule,
          countriesDataMap,
          roads,
          countryModifiersTemplate: countryProximityBuffsTemplate,
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
