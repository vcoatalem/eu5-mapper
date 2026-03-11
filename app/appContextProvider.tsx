"use client";

import { GameDataLoaderHelper } from "@/app/lib/gameDataLoader.helper";
import { useParams } from "next/navigation";
import { createContext, useEffect, useState } from "react";
import { IndexedDBWriter } from "./lib/indexeddb/indexeddb-writer";
import {
  dbAdjacencyDataStoreName,
  dbCountryModifiersTemplatesStoreName,
  dbDataKey,
  dbGameDataStoreName,
  dbLocationHierarchyStoreName,
  dbName,
  dbStoreNames,
  dbVersion,
} from "./lib/indexeddb/indexeddb.const";
import { LocationHierarchyService } from "./lib/locationHierarchy.service";
import { GameData } from "./lib/types/general";
import {
  GameDataFileType,
  VersionManifest,
} from "./lib/types/versionsManifest";

interface ImagePaths {
  locationsImage: string;
  borderLayer: string;
  terrainLayer: string;
}

interface AppContext {
  gameData: GameData | null;
  imagePaths: ImagePaths | null;
  isLoading: boolean;
  error: string | null;
}

const emptyContext: AppContext = {
  gameData: null,
  imagePaths: null,
  isLoading: true,
  error: null,
};

export const AppContext = createContext<AppContext>(emptyContext);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const params = useParams();
  const version = params?.version as string;

  // Game data state
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [imagePaths, setImagePaths] = useState<ImagePaths | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGameData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log(`[AppContext] Loading game data for version ${version}...`);
        const manifest =
          await GameDataLoaderHelper.loadManifestForVersion(version);

        const resolveAndPreloadImages = async (
          versionManifest: VersionManifest,
        ): Promise<ImagePaths> => {
          const imageFileTypes: Array<GameDataFileType> = [
            "locationsImage",
            "borderLayer",
            "terrainLayer",
          ];

          const imagePathsEntries = await Promise.all(
            imageFileTypes.map(async (fileType) => {
              const imagePath = GameDataLoaderHelper.getFileUrlForVersion(
                version,
                fileType,
                versionManifest,
              );

              await new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
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

              return [fileType, imagePath];
            }),
          );

          return {
            locationsImage:
              imagePathsEntries.find(
                ([type]) => type === "locationsImage",
              )?.[1] ?? "",
            borderLayer:
              imagePathsEntries.find(([type]) => type === "borderLayer")?.[1] ??
              "",
            terrainLayer:
              imagePathsEntries.find(
                ([type]) => type === "terrainLayer",
              )?.[1] ?? "",
          };
        };

        const [gameDataFiles, resolvedImagePaths] = await Promise.all([
          GameDataLoaderHelper.loadGameDataFilesForVersion(version, manifest),
          resolveAndPreloadImages(manifest),
        ]);

        const {
          locationData,
          buildingsTemplate,
          adjacencyCsv,
          proximityComputationRule,
          countriesData,
          roads,
        } = gameDataFiles;

        console.log("[AppContext] Parsed data:", {
          locationData,
          buildingsTemplate,
          adjacencyCsv,
          proximityComputationRule,
          countriesData,
          roads,
        });

        const toBePersistedGameData: GameData = {
          locationDataMap: locationData.map,
          colorToNameMap: {},
          buildingsTemplate: {},
          proximityComputationRule,
          countriesData: {},
          roads,
        };
        const indexedDBWriter = new IndexedDBWriter(
          dbName,
          dbVersion,
          dbStoreNames,
        );

        try {
          await Promise.all([
            indexedDBWriter.clearStore(dbGameDataStoreName),
            indexedDBWriter.clearStore(dbAdjacencyDataStoreName),
            indexedDBWriter.clearStore(dbCountryModifiersTemplatesStoreName),
            indexedDBWriter.clearStore(dbLocationHierarchyStoreName),
          ]);

          console.log("[AppContextProvider] fill indexeddb");
          await indexedDBWriter.put(
            dbGameDataStoreName,
            dbDataKey,
            toBePersistedGameData,
          );
          await indexedDBWriter.put(
            dbAdjacencyDataStoreName,
            dbDataKey,
            adjacencyCsv,
          );
          await indexedDBWriter.put(
            dbCountryModifiersTemplatesStoreName,
            dbDataKey,
            {},
          );
          await LocationHierarchyService.persistToIndexedDB(locationData.map);
        } catch (dbErr) {
          console.error(
            "[AppContext] IndexedDB error, dropping DB and reloading",
            dbErr,
          );
          indexedDB.deleteDatabase(dbName);
          window.location.reload();
          return;
        }

        // indexedDB operations have to be done before setGameData to ensure this happens before worldmap component initializes
        setImagePaths(resolvedImagePaths);
        setGameData({
          locationDataMap: locationData.map,
          colorToNameMap: locationData.colorToNameMap,
          buildingsTemplate,
          proximityComputationRule,
          countriesData,
          roads,
        });

        console.log(
          `[AppContext] Game data loaded: ${Object.keys(locationData.map).length} locations`,
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
