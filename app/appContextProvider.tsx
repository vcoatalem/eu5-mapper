"use client";

import {
  Dispatch,
  SetStateAction,
  useState,
  useEffect,
  createContext,
} from "react";
import { useParams } from "next/navigation";
import {
  ILocationIdentifier,
  ILocationDataMap,
  ILocationIdentifierMap,
  IBuildingTemplate,
  IGameData,
} from "./lib/types";

interface IAppContext {
  selectedLocation: ILocationIdentifier | null;
  setSelectedLocation: Dispatch<SetStateAction<ILocationIdentifier | null>>;
  hoveredLocation: ILocationIdentifier | null;
  setHoveredLocation: Dispatch<SetStateAction<ILocationIdentifier | null>>;
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
  const [selectedLocation, setSelectedLocation] =
    useState<ILocationIdentifier | null>(null);
  const [hoveredLocation, setHoveredLocation] =
    useState<ILocationIdentifier | null>(null);

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

        // Fetch all JSON files in parallel
        const [locationDataRes, colorToNameRes, buildingsRes] =
          await Promise.all([
            fetch(`${basePath}/location-data-map.json`),
            fetch(`${basePath}/color-to-name-map.json`),
            fetch(`${basePath}/buildings-template-map.json`),
          ]);

        if (!locationDataRes.ok || !colorToNameRes.ok || !buildingsRes.ok) {
          throw new Error(
            `Failed to load game data files for version ${version}`,
          );
        }

        const [locationDataMap, colorToNameMap, buildingsTemplateMap] =
          await Promise.all([
            locationDataRes.json(),
            colorToNameRes.json(),
            buildingsRes.json(),
          ]);

        setGameData({
          locationDataMap,
          colorToNameMap,
          buildingsTemplateMap,
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
        selectedLocation,
        setSelectedLocation,
        hoveredLocation,
        setHoveredLocation,
        gameData,
        isLoading,
        error,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
