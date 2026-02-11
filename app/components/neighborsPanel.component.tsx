import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { ILocationIdentifier, RoadType } from "../lib/types/general";
import {
  debouncedNeighborsProximityComputationController,
  neighborsProximityComputationController,
} from "@/app/lib/neighborsProximityComputation.controller";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ColorHelper } from "../lib/drawing/color.helper";
import { roadBuilderController } from "@/app/lib/roadBuilderController";
import { actionEventDispatcher } from "../lib/actionEventDispatcher";
import { EdgeType } from "../lib/types/pathfinding";
import { getGuiImage } from "../lib/drawing/namedGuiImagesMap.const";
import { Loader } from "./loader.component";
import { debouncedProximityComputationController } from "../lib/proximityComputation.controller";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";

const NeighborPanelListItem = memo(function NeighborPanelListItem({
  baseLocation,
  neighborLocation,
  cost,
  computationStatus,
  through,
  road,
  owned,
  isRoadBuildingMode,
}: {
  baseLocation: ILocationIdentifier;
  neighborLocation: ILocationIdentifier;
  cost: number;
  computationStatus: "pending" | "completed" | "error" | "needs_update";
  through: EdgeType;
  road: RoadType | null;
  owned: boolean;
  isRoadBuildingMode: boolean;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const locationNameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    console.log(
      "[NeighborPanelListItem] registering hover and click action sources for",
      neighborLocation,
    );
    const mainDiv = divRef.current;
    if (mainDiv) {
      actionEventDispatcher.registerHoverActionSource(
        mainDiv,
        () => neighborLocation,
      );
    }
    const locationNameDiv = locationNameRef.current;
    if (locationNameDiv) {
      actionEventDispatcher.registerClickActionSource(
        locationNameDiv,
        () => neighborLocation,
        "goto",
      );
    }
    return () => {
      console.log(
        "[NeighborPanelListItem] unregistering hover and click action sources for",
        neighborLocation,
      );
      if (mainDiv) {
        actionEventDispatcher.clearEventListenersForElement(mainDiv);
      }
      if (locationNameDiv) {
        actionEventDispatcher.clearEventListenersForElement(locationNameDiv);
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
    neighborsProximityComputationController.launchGetNeighborsProximity(
      baseLocation,
    );
  }, [road, baseLocation, neighborLocation]);

  return (
    <div
      key={neighborLocation}
      className={
        " grid grid-cols-6 items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded "
      }
      ref={divRef}
    >
      <span
        ref={locationNameRef}
        className={
          " truncate col-span-3 cursor-pointer " +
          (!owned ? "text-stone-500 italic" : "")
        }
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
            (road
              ? " bg-yellow-400 hover:bg-red-500 "
              : "bg-black hover:bg-stone-400")
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
        {computationStatus === "pending" && <Loader></Loader>}
        {computationStatus === "error" && "error"}
        {computationStatus === "needs_update" && "needs update"}
        {computationStatus === "completed" && <>{cost.toFixed(2)}</>}
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
    debouncedNeighborsProximityComputationController.subscribe.bind(
      debouncedNeighborsProximityComputationController,
    ),
    () => debouncedNeighborsProximityComputationController.getSnapshot(),
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

  const globalProximityResult = useSyncExternalStore(
    debouncedProximityComputationController.subscribe.bind(
      debouncedProximityComputationController,
    ),
    () => debouncedProximityComputationController.getSnapshot(),
  );

  const neighborLocationResult = computationResults?.[locationName];
  const computationStatus = computationResults?.[locationName]?.status;

  useEffect(() => {
    if (
      !neighborLocationResult ||
      neighborLocationResult.status === "needs_update"
    ) {
      neighborsProximityComputationController.launchGetNeighborsProximity(
        locationName,
      );
    }
  }, [neighborLocationResult]);

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
    <div
      className={
        "max-h-96 overflow-y-auto bg-black/70 backdrop-blur-sm border border-stone-700 rounded p-3" +
        (roadBuilderState.isBuildingModeEnabled ? " w-[400px] " : " w-[280px] ")
      }
    >
      <div className="w-full flex flex-row items-center mb-2">
        <div className="font-semibold text-stone-300">{locationName}</div>
        <span
          style={{
            color: ColorHelper.rgbToHex(
              ...ColorHelper.getEvaluationColor(
                globalProximityResult.result[locationName]?.cost ?? 0,
              ),
            ),
          }}
          className="ml-4"
        >
          {globalProximityResult.status === "pending" && <></>}
          {globalProximityResult.status === "updating" && <Loader></Loader>}
          {globalProximityResult.status === "completed" &&
            ProximityComputationHelper.evaluationToProximity(
              globalProximityResult.result[locationName]?.cost,
            )}
        </span>

        {roadBuilderState.isBuildingModeEnabled && (
          <button
            className="bg-yellow-400 hover:bg-yellow-500 rounded-lg ml-auto px-2 py-1 text-black"
            onClick={() => roadBuilderController.toggleBuildingMode()}
          >
            Done
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <span>adjacent regions proximity</span>
        {adjacentLocations.length === 0 && computationStatus === "pending" && (
          <div className="w-full h-10">
            <Loader></Loader>
          </div>
        )}
        {adjacentLocations.map(({ location, cost, through, road, owned }) => (
          <NeighborPanelListItem
            key={location}
            baseLocation={locationName}
            neighborLocation={location}
            cost={cost}
            computationStatus={computationStatus}
            through={through}
            road={road}
            owned={owned}
            isRoadBuildingMode={roadBuilderState.isBuildingModeEnabled}
          ></NeighborPanelListItem>
        ))}
      </div>
    </div>
  );
}
