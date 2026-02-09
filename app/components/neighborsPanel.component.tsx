import { useSyncExternalStore } from "react";
import { ILocationIdentifier } from "../lib/types/general";
import { neighborsProximityComputationController } from "../lib/neighborsProximityComputation.controller";
import { gameStateController } from "../lib/gameState.controller";
import { ColorHelper } from "../lib/drawing/color.helper";

interface NeighborsPanelProps {
  locationName: ILocationIdentifier;
}

export function NeighborsPanelComponent({ locationName }: NeighborsPanelProps) {
  const { computationResults } = useSyncExternalStore(
    neighborsProximityComputationController.subscribe.bind(
      neighborsProximityComputationController,
    ),
    () => {
      return neighborsProximityComputationController.getSnapshot();
    },
  );

  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => {
      return gameStateController.getSnapshot();
    },
  );

  // TODO: allow to load panel with no results (road construction, among other things)
  const neighborLocationResult = computationResults?.[locationName];

  // TODO: this might actually be the place to add road building.

  return (
    <div className="max-h-96 overflow-y-auto bg-black/90 backdrop-blur-sm border border-stone-700 rounded p-3">
      <div className="font-semibold mb-2 text-stone-300">{locationName}</div>
      {neighborLocationResult?.status === "completed" && (
        <div className="flex flex-col gap-1 text-xs">
          <span>adjacent regions proximity</span>
          {Object.entries(neighborLocationResult.neighbors)
            .filter(([neighborName]) => neighborName !== locationName)
            .map(([neighborName, { cost, through }]) => (
              <div
                key={neighborName}
                className="grid grid-cols-5 items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded w-[300px]"
              >
                <span
                  className={
                    " truncate col-span-3 " +
                    (!(neighborName in gameState.ownedLocations)
                      ? "text-stone-500 italic"
                      : "")
                  }
                >
                  {neighborName}
                  {!(neighborName in gameState.ownedLocations) && (
                    <span> (unowned)</span>
                  )}
                </span>

                <span
                  className="ml-2 col-span-1"
                  style={{
                    color: ColorHelper.rgbToHex(
                      ...ColorHelper.getEvaluationColor(cost),
                    ),
                  }}
                >
                  {cost.toFixed(2)}
                </span>
                <span className="col-span-1"> ({through})</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
