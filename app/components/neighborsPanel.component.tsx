import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { ILocationIdentifier, RoadType } from "../lib/types/general";
import { neighborsProximityComputationController } from "@/app/lib/neighborsProximityComputation.controller";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ColorHelper } from "../lib/drawing/color.helper";
import { roadBuilderController } from "@/app/lib/roadBuilderController";
import { actionEventDispatcher } from "../lib/actionEventDispatcher";
import { EdgeType } from "../lib/types/pathfinding";
import { getGuiImage } from "../lib/drawing/namedGuiImagesMap.const";

const NeighborPanelListItem = memo(function NeighborPanelListItem({
  baseLocation,
  neighborLocation,
  cost,
  through,
  road,
  owned,
  isRoadBuildingMode,
}: {
  baseLocation: ILocationIdentifier;
  neighborLocation: ILocationIdentifier;
  cost: number;
  through: EdgeType;
  road: RoadType | null;
  owned: boolean;
  isRoadBuildingMode: boolean;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = divRef.current;
    if (el) {
      actionEventDispatcher.registerHoverActionSource(
        el,
        () => neighborLocation,
      );
      actionEventDispatcher.registerClickActionSource(
        el,
        () => neighborLocation,
        "goto",
      );
    }
    return () => {
      if (el) {
        actionEventDispatcher.clearEventListenersForElement(el);
      }
    };
  }, [neighborLocation]);

  const handleRoadChange = useCallback(() => {
    if (road) {
      gameStateController.changeRoadType(
        `${baseLocation}-${neighborLocation}`,
        null,
      );
    } else {
      gameStateController.changeRoadType(
        `${baseLocation}-${neighborLocation}`,
        "gravel_road",
      );
    }
    neighborsProximityComputationController.launchGetNeighborProximityTask(
      baseLocation,
    );
  }, [road, baseLocation, neighborLocation]);

  return (
    <div
      key={neighborLocation}
      className={
        " grid grid-cols-6 items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded " +
        (isRoadBuildingMode ? " w-[400px] " : " w-[280px] ")
      }
    >
      <span
        className={
          " truncate col-span-3 cursor-pointer " +
          (!owned ? "text-stone-500 italic" : "")
        }
        ref={divRef}
      >
        {neighborLocation}
        {!owned && <span> (unowned)</span>}
      </span>

      {isRoadBuildingMode && (
        <img
          src={getGuiImage("gravel_road") ?? ""}
          alt="road"
          width={32}
          height={32}
          className={
            " col-span-1 p-1 " +
            (road ? " bg-yellow-400 " : "bg-black hover:bg-yellow-400")
          }
          onClick={() => handleRoadChange()}
        />
      )}

      <span
        className="ml-2 col-span-1"
        style={{
          color: ColorHelper.rgbToHex(...ColorHelper.getEvaluationColor(cost)),
        }}
      >
        {cost.toFixed(2)}
      </span>
      <span className="col-span-1"> ({through})</span>
    </div>
  );
});

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

  const roadBuilderState = useSyncExternalStore(
    roadBuilderController.subscribe.bind(roadBuilderController),
    () => {
      return roadBuilderController.getSnapshot();
    },
  );

  // TODO: allow to load panel with no results (road construction, among other things)
  const neighborLocationResult = computationResults?.[locationName];

  const adjacentLocations = Object.entries(
    neighborLocationResult?.neighbors ?? {},
  )
    .filter(([location, { through }]) => {
      if (location === locationName) return false;
      if (roadBuilderState.isBuildingModeEnabled) {
        return through === "land" || through === "river";
      } else {
        return true;
      }
    })
    .map(([location, data]) => ({
      location,
      cost: data.cost,
      through: data.through,
      road:
        gameState.roads[locationName]?.find((r) => r.to === location)?.type ??
        null,
      owned: gameState.ownedLocations[location] !== undefined,
    }));

  return (
    <div className="max-h-96 overflow-y-auto bg-black/70 backdrop-blur-sm border border-stone-700 rounded p-3">
      <div className="font-semibold mb-2 text-stone-300">{locationName}</div>
      {neighborLocationResult?.status === "completed" && (
        <div className="flex flex-col gap-1 text-xs">
          <span>adjacent regions proximity</span>

          {adjacentLocations.map(({ location, cost, through, road, owned }) => (
            <NeighborPanelListItem
              key={location}
              baseLocation={locationName}
              neighborLocation={location}
              cost={cost}
              through={through}
              road={road}
              owned={owned}
              isRoadBuildingMode={roadBuilderState.isBuildingModeEnabled}
            ></NeighborPanelListItem>
          ))}
        </div>
      )}
    </div>
  );
}
