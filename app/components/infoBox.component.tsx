import { JSX, useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { IGameState, ILocationGameData } from "../lib/types/general";
import { CompactGraph } from "../lib/graph";
import { NeighborInfo } from "../lib/types/pathfinding";
import { gameStateController } from "@/app/lib/gameStateController";

const buildLocationDisplay = (
  locationData: ILocationGameData,
  adjacencyGraph: CompactGraph,
  gameState: IGameState,
): JSX.Element => {
  const neighborLocationsNames = adjacencyGraph.getNeighborNodesNames(
    locationData.name,
  );

  const getConnectionType = (neighbor: NeighborInfo): string => {
    if (!neighbor) return "unknown";
    if (neighbor.isPort) return "port";
    if (neighbor.isLand) return "land";
    if (neighbor.isSea) return "sea";
    if (neighbor.isRiver) return "river";
    if (neighbor.isLake) return "lake";
    return "unknown";
  };

  const owned = gameState.ownedLocations[locationData.name];

  if (!locationData) {
    return <span>No data available</span>;
  }
  return (
    <>
      <div className="flex flex-col h-full">
        <span className="font-bold text-lg">{locationData.name}</span>
        <span className="text-stone-600">
          {!locationData.ownable && <span>Not Ownable</span>}
        </span>
        <span>Topography: {locationData.topography}</span>
        {locationData.vegetation && (
          <span>Vegetation: {locationData.vegetation}</span>
        )}
      </div>
      <span>Development: {locationData.development}</span>
      <span>Population: {locationData.population}</span>
      <span>{owned ? "Owned" : "Not Owned"}</span>

      {locationData.constructibleLocationCoordinate && (
        <span>
          {locationData.constructibleLocationCoordinate.x},
          {locationData.constructibleLocationCoordinate.y}
        </span>
      )}

      {neighborLocationsNames.length > 0 && (
        <div className="flex flex-col">
          <span className="font-semibold mt-2">Neighbors:</span>
          <ul className="list-disc list-inside">
            {neighborLocationsNames.map((neighbor) => (
              <li key={neighbor.name}>
                {neighbor.name} (through: {getConnectionType(neighbor)} )
              </li>
            ))}
          </ul>
        </div>
      )}

      <hr className="border border-stone-600 my-2 mt-auto"></hr>

      {locationData.hierarchy && (
        <div className="flex flex-col">
          <span className="text-wrap">
            Part of {locationData.hierarchy.province}
          </span>
          <span>({locationData.hierarchy.subcontinent})</span>
        </div>
      )}
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
    <span></span>
  );

  return (
    <div className={`min-w-64 min-h-96 max-h-128 flex flex-col`}>
      {locationDisplay}
    </div>
  );
}
