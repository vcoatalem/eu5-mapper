import { JSX, useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { IGameState, ILocationGameData } from "../lib/types/general";
import { CompactGraph } from "../lib/graph";
import { NeighborInfo } from "../lib/types/pathfinding";
import { gameStateController } from "@/app/lib/gameState.controller";

const buildLocationDisplay = (
  locationData: ILocationGameData,
  adjacencyGraph: CompactGraph,
  gameState: IGameState,
): JSX.Element => {
  const owned = gameState.ownedLocations[locationData.name];

  if (!locationData) {
    return <span>No data available</span>;
  }
  return (
    <>
      <div className="flex flex-row items-center gap-6 px-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base">{locationData.name}</span>
          {!locationData.ownable && (
            <span className="text-xs text-stone-400">(Not Ownable)</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span>🏔️ {locationData.topography}</span>
          {locationData.vegetation && <span>🌿 {locationData.vegetation}</span>}
          <span>📈 Dev: {locationData.development}</span>
          <span>👥 Pop: {locationData.population}</span>
          <span>{owned ? "✓ Owned" : "○ Not Owned"}</span>
        </div>

        {locationData.hierarchy && (
          <div className="flex items-center gap-2 text-xs text-stone-300 ml-auto">
            <span>{locationData.hierarchy.province}</span>
            <span className="text-stone-500">•</span>
            <span>{locationData.hierarchy.subcontinent}</span>
          </div>
        )}
      </div>
    </>
  );
};

export function InfoBoxComponent() {
  const context = useContext(AppContext);
  const gameLogic = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  if (!context) {
    throw new Error("InfoBoxComponent must be used within AppContextProvider");
  }
  if (!context.gameData) {
    throw new Error("Game data is not available in InfoBoxComponent");
  }
  if (!context.adjacencyGraph) {
    throw new Error("Adjacency graph is not available in InfoBoxComponent");
  }

  const locationName =
    context?.hoveredLocation ?? context?.selectedLocation ?? null;

  const locationDisplay = locationName ? (
    buildLocationDisplay(
      context.gameData.locationDataMap[locationName],
      context.adjacencyGraph,
      gameLogic,
    )
  ) : (
    <span className="text-sm text-stone-400 px-4">
      Hover or select a location to view details
    </span>
  );

  return (
    <div
      className={`w-full h-10 flex items-center bg-black/80 backdrop-blur-sm border-t border-stone-700`}
    >
      {locationDisplay}
    </div>
  );
}
