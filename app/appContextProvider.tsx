"use client";

import {
  Dispatch,
  SetStateAction,
  useState,
  useEffect,
  createContext,
} from "react";
import { useParams } from "next/navigation";
import { ILocationIdentifier, IGameData } from "./lib/types/general";
import { CompactGraph } from "./lib/graph";
import { ParserHelper } from "./lib/parserHelper";

interface IAppContext {
  selectedLocation: ILocationIdentifier | null;
  setSelectedLocation: Dispatch<SetStateAction<ILocationIdentifier | null>>;
  hoveredLocation: ILocationIdentifier | null;
  setHoveredLocation: Dispatch<SetStateAction<ILocationIdentifier | null>>;
  gameData: IGameData | null;
  adjacencyGraph: CompactGraph | null;
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
  const [adjacencyGraph, setAdjacencyGraph] = useState<CompactGraph | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGameData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`[AppContext] Loading game data for version ${version}...`);

        const basePath = `/${version}/game_data`;

        // Fetch all JSON files and CSV in parallel
        const [
          locationDataRes,
          colorToNameRes,
          buildingsRes,
          adjacencyRes,
          proximityComputationRuleRes,
        ] = await Promise.all([
          fetch(`${basePath}/location-data-map.json`),
          fetch(`${basePath}/color-to-name-map.json`),
          fetch(`${basePath}/buildings-template-map.json`),
          fetch(`${basePath}/adjacency-data.csv`),
          fetch(`${basePath}/proximity-calculation-rules.json`),
        ]);

        if (
          !locationDataRes.ok ||
          !colorToNameRes.ok ||
          !buildingsRes.ok ||
          !adjacencyRes.ok ||
          !proximityComputationRuleRes.ok
        ) {
          throw new Error(
            `Failed to load game data files for version ${version}`,
          );
        }

        const [
          locationDataMap,
          colorToNameMap,
          buildingsTemplateMap,
          adjacencyCsv,
          proximityComputationRule,
        ] = await Promise.all([
          locationDataRes.json(),
          colorToNameRes.json(),
          buildingsRes.json(),
          adjacencyRes.text(),
          proximityComputationRuleRes.json(),
        ]);

        setGameData({
          locationDataMap,
          colorToNameMap,
          buildingsTemplateMap,
          proximityComputationRule,
        });

        console.log(
          `[AppContext] Game data loaded: ${Object.keys(locationDataMap).length} locations`,
        );

        // Parse adjacency CSV and build graph
        console.log(`[AppContext] Building adjacency graph...`);
        const graph = ParserHelper.parseAdjacencyCSV(adjacencyCsv);

        setAdjacencyGraph(graph);
        const stats = graph.getStats();
        console.log(`[AppContext] Adjacency graph built:`, stats);
        console.log(`  - Nodes: ${stats.nodes}`);
        console.log(`  - Total edges: ${stats.edges}`);
        console.log(`  - River edges: ${stats.riverEdges}`);
        console.log(`  - Land edges: ${stats.landEdges}`);
        console.log(`  - Sea edges: ${stats.seaEdges}`);
        console.log(`  - Port edges: ${stats.portEdges}`);
        console.log(`  - Lake edges: ${stats.lakeEdges}`);

        // Set isCoastal, isOnRiver, and isOnLake properties on locationDataMap
        console.log(
          `[AppContext] Setting location coastal, river, and lake properties...`,
        );
        let coastalCount = 0;
        let riverCount = 0;
        let lakeCount = 0;

        for (const locationName in locationDataMap) {
          //TODO: lets add these to the script that generates static data files, as they prove to be quite long to compute
          const neighbors = graph.getNeighborNodesNames(locationName);

          const hasPortEdge = neighbors.some((n) => n.isPort);
          const hasRiverEdge = neighbors.some((n) => n.isRiver);
          const hasLakeEdge = neighbors.some((n) => n.isLake);

          locationDataMap[locationName].isCoastal = hasPortEdge;
          locationDataMap[locationName].isOnRiver = hasRiverEdge;
          locationDataMap[locationName].isOnLake = hasLakeEdge;

          if (hasPortEdge) coastalCount++;
          if (hasRiverEdge) riverCount++;
          if (hasLakeEdge) lakeCount++;
        }

        console.log(`  - Coastal locations: ${coastalCount}`);
        console.log(`  - River locations: ${riverCount}`);
        console.log(`  - Lake locations: ${lakeCount}`);
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
        adjacencyGraph,
        isLoading,
        error,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
