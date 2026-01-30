import { useEffect, useSyncExternalStore } from "react";
import { ILocationIdentifier } from "../lib/types/general";
import { neighborsProximityComputationController } from "../lib/neighborsProximityComputation.controller";
import { DrawingHelper } from "../lib/drawing/drawing.helper";

interface NeighborsPanelProps {
  locationName: ILocationIdentifier;
}

export function NeighborsPanelComponent({ locationName }: NeighborsPanelProps) {
  console.log("Rendering NeighborsPanelComponent for", { locationName });
  const { computationResults } = useSyncExternalStore(
    neighborsProximityComputationController.subscribe.bind(
      neighborsProximityComputationController,
    ),
    () => {
      return neighborsProximityComputationController.getSnapshot();
    },
  );

  useEffect(() => {
    neighborsProximityComputationController.launchGetNeighborProximityTask(
      locationName,
    );
  }, [locationName]);

  const neighborLocationResult = computationResults?.[locationName];
  if (!neighborLocationResult) {
    return <></>;
  }

  //adjacencyGraph.getNeighborNodesNames(locationName);

  /*   const getConnectionType = (neighbor: NeighborInfo): string => {
    if (!neighbor) return "?";
    if (neighbor.isPort) return "(Port)";
    if (neighbor.isLand) return "(Land)";
    if (neighbor.isSea) return "(Sea)";
    if (neighbor.isRiver) return "(River)";
    if (neighbor.isLake) return "(Lake)";
    return "? Unknown";
  }; */

  return (
    <div className="w-64 max-h-96 overflow-y-auto bg-black/90 backdrop-blur-sm border border-stone-700 rounded p-3">
      <span>{neighborLocationResult?.status}</span>
      <div className="font-semibold text-sm mb-2 text-stone-300">
        Proximity costs for {locationName}
      </div>
      {
        <div className="flex flex-col gap-1 text-xs">
          {Object.entries(neighborLocationResult.neighbors)
            .filter(([neighborName]) => neighborName !== locationName)
            .map(([neighborName, distance]) => (
              <div
                key={neighborName}
                className="flex items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded"
              >
                <span className="truncate flex-1">
                  {" "}
                  {locationName + "<->" + neighborName}
                </span>
                <span
                  className="ml-2"
                  style={{
                    color: DrawingHelper.rgbToHex(
                      ...DrawingHelper.getEvaluationColor(distance),
                    ),
                  }}
                >
                  {distance}
                </span>
              </div>
            ))}
        </div>
      }
    </div>
  );
}
