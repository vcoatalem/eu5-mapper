import { useContext } from "react";
import { AppContext } from "../appContextProvider";
import { ILocationIdentifier } from "../lib/types/general";
import { NeighborInfo } from "../lib/types/pathfinding";

interface NeighborsPanelProps {
  locationName: ILocationIdentifier;
}

export function NeighborsPanelComponent({ locationName }: NeighborsPanelProps) {
  const { adjacencyGraph } = useContext(AppContext);

  if (!adjacencyGraph) {
    return null;
  }

  const neighborLocationsNames =
    adjacencyGraph.getNeighborNodesNames(locationName);

  const getConnectionType = (neighbor: NeighborInfo): string => {
    if (!neighbor) return "?";
    if (neighbor.isPort) return "(Port)";
    if (neighbor.isLand) return "(Land)";
    if (neighbor.isSea) return "(Sea)";
    if (neighbor.isRiver) return "(River)";
    if (neighbor.isLake) return "(Lake)";
    return "? Unknown";
  };

  return (
    <div className="w-64 max-h-96 overflow-y-auto bg-black/90 backdrop-blur-sm border border-stone-700 rounded p-3">
      <div className="font-semibold text-sm mb-2 text-stone-300">
        Neighbors of {locationName}
      </div>
      <div className="flex flex-col gap-1 text-xs">
        {neighborLocationsNames.map((neighbor) => (
          <div
            key={neighbor.name}
            className="flex items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded"
          >
            <span className="truncate flex-1">{neighbor.name}</span>
            <span className="text-stone-400 ml-2 flex-shrink-0">
              {getConnectionType(neighbor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
