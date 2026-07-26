"use client";

import { TILE_SIZE, COLS, ROWS } from "@/app/components/worldMap.config";
import { GameDataLoaderHelper } from "@/app/lib/gameDataLoader.helper";
import { TileUrlGrid } from "@/app/lib/tiling/tileTypes";
import { useGameDataVersion } from "@/app/[version]/version.guard";
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
import { VersionManifest } from "./lib/types/versionsManifest";

interface ImagePaths {
  locationsImage: string;
}

interface AppContext {
  gameData: GameData | null;
  imagePaths: ImagePaths | null;
  tileUrls: TileUrlGrid | null;
  isLoading: boolean;
  error: string | null;
}

const emptyContext: AppContext = {
  gameData: null,
  imagePaths: null,
  tileUrls: null,
  isLoading: true,
  error: null,
};

function assertTileGridMatchesManifest(manifest: VersionManifest): void {
  const { tileSize, cols, rows } = manifest.metadata.tileGrid;
  if (tileSize !== TILE_SIZE || cols !== COLS || rows !== ROWS) {
    throw new Error(
      `[AppContext] manifest.metadata.tileGrid {tileSize:${tileSize},cols:${cols},rows:${rows}} ` +
        `does not match app config {tileSize:${TILE_SIZE},cols:${COLS},rows:${ROWS}}`,
    );
  }
}

export const AppContext = createContext<AppContext>(emptyContext);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const version = useGameDataVersion();

  // Game data state
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [imagePaths, setImagePaths] = useState<ImagePaths | null>(null);
  const [tileUrls, setTileUrls] = useState<TileUrlGrid | null>(null);
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
        assertTileGridMatchesManifest(manifest);
        const resolvedTileUrls = GameDataLoaderHelper.buildTileUrlGrid(
          version,
          manifest,
        );

        // Only `locationsImage` is still fetched as a whole image (out of scope for
        // per-tile fetching — locations.png is a point-query color/ID map, not tile-shaped).
        const resolveAndPreloadImages = async (
          versionManifest: VersionManifest,
        ): Promise<ImagePaths> => {
          const imagePath = GameDataLoaderHelper.getFileUrlForVersion(
            version,
            "locationsImage",
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
              const error = new Error(`Failed to preload image: ${imagePath}`);
              console.error(`[AppContext] ${error.message}`, e);
              reject(error);
            };
            img.src = imagePath;
          });

          return { locationsImage: imagePath };
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
        setTileUrls(resolvedTileUrls);
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
        tileUrls,
        isLoading,
        error,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
