import { gameStateController } from "@/app/lib/gameState.controller";
import {
  debouncedNeighborsProximityComputationController,
  neighborsProximityComputationController,
} from "@/app/lib/neighborsProximityComputation.controller";
import { roadBuilderController } from "@/app/lib/roadBuilderController";
import Image from "next/image";
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { ActionSource } from "../lib/actionSource.component";
import { getGuiImage } from "../lib/drawing/namedGuiImagesMap.const";
import { debouncedProximityComputationController } from "../lib/proximityComputation.controller";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { ILocationIdentifier, RoadType } from "../lib/types/general";
import { EdgeType } from "../lib/types/pathfinding";
import { FormatedProximity } from "./formatedProximity.component";
import { FormatedProximityCost } from "./formatedProximityCost.component";
import { Loader } from "./loader.component";
import { maritimePresenceEditController } from "@/app/lib/maritimePresenceEditController";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { LocationsHelper } from "@/app/lib/locations.helper";
import { AppContext } from "@/app/appContextProvider";
import { EditableField } from "@/app/components/editableField.component";
import styles from "@/app/styles/button.module.css";
import { ColorHelper } from "@/app/lib/drawing/color.helper";

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
    <ActionSource locations={() => neighborLocation} hover={{}}>
      <div
        key={neighborLocation}
        className={
          " grid grid-cols-6 items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded "
        }
      >
        <ActionSource
          locations={() => neighborLocation}
          click={{ type: "goto" }}
        >
          <span
            className={
              " truncate col-span-3 cursor-pointer " +
              (!owned ? "text-stone-500 italic" : "")
            }
          >
            {neighborLocation}
            {!owned && <span> (unowned)</span>}
          </span>
        </ActionSource>

        {isRoadBuildingMode && (
          <Image
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

        <span className="ml-2 col-span-1">
          {computationStatus === "pending" || computationStatus === "needs_update" && <Loader></Loader>}
          {computationStatus === "error" && "error"}
          {computationStatus === "completed" && (
            <FormatedProximityCost proximityCost={cost}></FormatedProximityCost>
          )}
        </span>
        <span className="col-span-1"> ({through})</span>
      </div>
    </ActionSource>
  );
});

interface NeighborsPanelProps {
  locationName: ILocationIdentifier;
}

export function NeighborsPanelComponent({ locationName }: NeighborsPanelProps) {

  const gameData = useContext(AppContext).gameData;
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

  const maritimePresenceEditState = useSyncExternalStore(
    maritimePresenceEditController.subscribe.bind(maritimePresenceEditController),
    () => {
      return maritimePresenceEditController.getSnapshot();
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

  const adjacentLocations = useMemo(() => Object.entries(
    neighborLocationResult?.neighbors ?? {},
  )
    .filter(([location, { through }]) => {
      if (location === locationName) return false;
      if (roadBuilderState.isModeEnabled) {
        return through === "land" || through === "river";
      }
      else if (maritimePresenceEditState.isModeEnabled) {
        return through === "sea" || through === "lake" || through === "through-sea";
      }
      else {
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
    })), [neighborLocationResult, roadBuilderState, maritimePresenceEditState, gameState, locationName]);

  const locationMaritimePresence = useMemo(() => {
    if (!gameData || !gameState) {
      return -1;
    }
    /* console.log("[NeighborsPanelComponent] locationMaritimePresence", gameData?.locationDataMap[locationName], gameState.temporaryLocationData[locationName]); */
    if (!gameData.locationDataMap[locationName]) {
      return -1;
    }
    return LocationsHelper.getLocationMaritimePresence(gameData.locationDataMap[locationName], gameState.temporaryLocationData[locationName] ?? null);
  }, [gameData, gameState, locationName]);


  /*  console.log("[NeighborsPanelComponent] locationMaritimePresence", locationMaritimePresence); */
  return (
    <div
      className={
        "max-h-96 min-h-52 overflow-y-auto backdrop-blur-sm p-3" +
        (roadBuilderState.isModeEnabled ? " w-[400px] " : " w-[280px] ")
      }
    >
      <div className="w-full flex flex-row items-center mb-2">
        <div className="font-semibold text-stone-300">{locationName ? StringHelper.formatLocationName(locationName) : ""}</div>
        {locationName in globalProximityResult.result && (
          <span className="ml-4">
            {globalProximityResult.status === "pending" && <></>}
            {globalProximityResult.status === "updating" && <Loader></Loader>}
            {globalProximityResult.status === "completed" && (
              <FormatedProximity
                proximity={ProximityComputationHelper.evaluationToProximity(
                  globalProximityResult.result[locationName]?.cost ?? 100,
                )}
              ></FormatedProximity>
            )}
          </span>
        )}
        {roadBuilderState.isModeEnabled && (
          <button
            className={[styles.simpleButton, "ml-auto"].join(" ")}
            onClick={() => roadBuilderController.toggleMode()}
          >
            Done
          </button>
        )}

        {maritimePresenceEditState.isModeEnabled && maritimePresenceEditState.location === locationName && (
          <button
            className={[styles.simpleButton, "ml-auto"].join(" ")}
            onClick={() => maritimePresenceEditController.toggleMode()}
          >
            Done
          </button>
        )}
      </div>
      <hr className="my-2 border-stone-300 w-full"></hr>
      {locationMaritimePresence > -1 && (
        <>
          <div className="flex flex-row items-center gap-2 relative">⚓ Maritime Presence: 
            <EditableField
              key={locationName}
              autoFocus={maritimePresenceEditState.isModeEnabled && maritimePresenceEditState.location === locationName}
              onValidate={(value) => {
                gameStateController.changeTemporaryLocationData(locationName, { maritimePresence: value });
              }}
              tooltip={<span>Edit maritime presence</span>}
              value={locationMaritimePresence}
              baseValue={locationMaritimePresence}
            >
              <span style={{ color: ColorHelper.rgbToHex(...ColorHelper.getMaritimePresenceColor(locationMaritimePresence)) }}>{locationMaritimePresence}</span>
            </EditableField></div>
          <hr className="my-2 border-stone-300 w-full"></hr>
        </>
      )}

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
            isRoadBuildingMode={roadBuilderState.isModeEnabled}
          ></NeighborPanelListItem>
        ))}
      </div>
    </div>
  );
}
