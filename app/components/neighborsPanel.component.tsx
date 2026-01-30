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
            .filter(([, { through }]) => through !== "unowned_location")
            .map(([neighborName, { cost, through }]) => (
              <div
                key={neighborName}
                className="flex items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded"
              >
                <span className="truncate flex-1"> {neighborName}</span>
                <span
                  className="ml-2"
                  style={{
                    color: DrawingHelper.rgbToHex(
                      ...DrawingHelper.getEvaluationColor(cost),
                    ),
                  }}
                >
                  {cost.toFixed(2)}
                </span>
                <span> ({through})</span>
              </div>
            ))}
        </div>
      }
    </div>
  );
}
