import { gameStateController } from "@/app/lib/gameState.controller";
import {
  debouncedNeighborsProximityComputationController,
  neighborsProximityComputationController,
} from "@/app/lib/neighborsProximityComputation.controller";
import { editModeController } from "@/app/lib/editMode.controller";
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
import { ILocationIdentifier } from "../lib/types/general";
import { EdgeType } from "../lib/types/pathfinding";
import { FormatedProximityCost } from "./formatedProximityCost.component";
import { Loader } from "./loader.component";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { LocationsHelper } from "@/app/lib/locations.helper";
import { AppContext } from "@/app/appContextProvider";
import { EditableField } from "@/app/components/editableField.component";
import { validateFloatInRange } from "@/app/lib/utils/editableFieldValidation.helper";
import styles from "@/app/styles/button.module.css";
import { ColorHelper } from "@/app/lib/drawing/color.helper";
import { FormattedProximityWithPathfindingTooltip } from "@/app/components/formattedProximityWithPathfindingTooltip.component";
import { RoadsHelper } from "@/app/lib/roads.helper";
import { asRoadKey, RoadType } from "@/app/lib/types/roads";

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
    const key = asRoadKey(`${baseLocation}-${neighborLocation}`);
    if (road) {
      gameStateController.changeRoadType(key, null);
    } else {
      gameStateController.changeRoadType(key, "gravel_road");
    }
    neighborsProximityComputationController.launchGetNeighborsProximity(
      baseLocation,
    );
  }, [road, baseLocation, neighborLocation]);

  return (
    <ActionSource locations={() => [neighborLocation]} hover={{}}>
      <div
        key={neighborLocation}
        className={
          " grid grid-cols-6 items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded "
        }
      >
        <ActionSource
          locations={() => [neighborLocation]}
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
          {["pending", "needs_update"].includes(computationStatus) && <Loader></Loader>}
          {computationStatus === "error" && "error"}
          {computationStatus === "completed" && (
            <FormatedProximityCost proximityCost={cost}></FormatedProximityCost>
          )}
        </span>
        <span className="col-span-1 pl-2"> ({through})</span>
      </div>
    </ActionSource>
  );
});

interface NeighborsPanelProps {
  baseLocation: ILocationIdentifier;
}

export function NeighborsPanelComponent({ baseLocation }: NeighborsPanelProps) {

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

  const maritimePresenceEditState = useSyncExternalStore(
    editModeController.maritimeSlice.subscribe.bind(editModeController.maritimeSlice),
    () => editModeController.maritimeSlice.getSnapshot(),
  );

  const roadEditState = useSyncExternalStore(
    editModeController.roadSlice.subscribe.bind(editModeController.roadSlice),
    () => editModeController.roadSlice.getSnapshot(),
  );

  const editModeState = useSyncExternalStore(
    editModeController.subscribe.bind(editModeController),
    () => editModeController.getSnapshot(),
  );

  const globalProximityResult = useSyncExternalStore(
    debouncedProximityComputationController.subscribe.bind(
      debouncedProximityComputationController,
    ),
    () => debouncedProximityComputationController.getSnapshot(),
  );

  const neighborLocationResult = computationResults?.[baseLocation];

  useEffect(() => {
    if (
      !neighborLocationResult ||
      neighborLocationResult.status === "needs_update"
    ) {
      neighborsProximityComputationController.launchGetNeighborsProximity(
        baseLocation,
      );
    }
  }, [neighborLocationResult]);

  const adjacentLocations = useMemo(() => Object.entries(
    neighborLocationResult?.neighbors ?? {},
  )
    .filter(([location, { through }]) => {
      switch (true) {
        case location === baseLocation:
          return false;
        case roadEditState.isModeEnabled:
          return through === "land" || through === "river";
        case maritimePresenceEditState.isModeEnabled:
          return through === "sea" || through === "lake" || through === "through-sea";
        default:
          return true;
      }
    })
    .map(([location, data]) => ({
      location,
      cost: data.cost,
      through: data.through,
      road: gameData
        ? RoadsHelper.getRoad(baseLocation, location, gameData.roads, gameState.roads)
        : null,
      owned: gameState.ownedLocations[location] !== undefined,
    })), [neighborLocationResult, roadEditState, maritimePresenceEditState, gameState, gameData, baseLocation]);

  const locationMaritimePresence = useMemo(() => {
    if (!gameData || !gameState) {
      return -1;
    }
    if (!gameData.locationDataMap[baseLocation]) {
      return -1;
    }
    return LocationsHelper.getLocationMaritimePresence(gameData.locationDataMap[baseLocation], gameState.temporaryLocationData[baseLocation] ?? null);
  }, [gameData, gameState, baseLocation]);


  /*  console.log("[NeighborsPanelComponent] locationMaritimePresence", locationMaritimePresence); */
  return (
    <div
      className={
        "max-h-96 min-h-52 overflow-y-auto backdrop-blur-sm p-3" +
        (roadEditState.isModeEnabled ? " w-[400px] " : " w-[280px] ")
      }
    >
      <div className="w-full flex flex-row items-center mb-2">
        <div className="font-semibold text-stone-300">{baseLocation ? StringHelper.formatLocationName(baseLocation) : ""}</div>
        {baseLocation in globalProximityResult.result && (
          <span className="ml-4">
            {["pending", "updating"].includes(globalProximityResult.status) && <Loader></Loader>}
            {globalProximityResult.status === "completed" && (
              <FormattedProximityWithPathfindingTooltip
                location={baseLocation}
                proximity={ProximityComputationHelper.evaluationToProximity(
                  globalProximityResult.result[baseLocation]?.cost ?? 100,
                )}
              ></FormattedProximityWithPathfindingTooltip>
            )}
          </span>
        )}
        {
          editModeState.modeEnabled !== "acquire" && (
            <button
              className={[styles.simpleButton, "ml-auto"].join(" ")}
              onClick={() => editModeController.reset()}
            >
              Done
            </button>
          )
        }
      </div>
      <hr className="my-2 border-stone-300 w-full"></hr>
      {locationMaritimePresence > -1 && (
        <>
          <div className="flex flex-row items-center gap-2 relative flex-1">⚓ Maritime Presence:
            <EditableField<number>
              className="w-16"
              key={baseLocation}
              autoFocus={maritimePresenceEditState.isModeEnabled && maritimePresenceEditState.selectedLocation === baseLocation}
              value={locationMaritimePresence}
              baseValue={locationMaritimePresence}
              validate={(raw) => validateFloatInRange(raw, 0, 101)}
              onValidate={(value) => {
                gameStateController.changeTemporaryLocationData(baseLocation, { maritimePresence: value });
              }}
              tooltip={<span>Edit maritime presence</span>}
            >
              <span style={{ color: ColorHelper.rgbToHex(...ColorHelper.getMaritimePresenceColor(locationMaritimePresence)) }}>{locationMaritimePresence}</span>
            </EditableField></div>
          <hr className="my-2 border-stone-300 w-full"></hr>
        </>
      )}

      <div className="flex flex-col gap-1 text-xs">

        <span>adjacent regions proximity</span>
        {adjacentLocations.length === 0 && computationResults?.[baseLocation]?.status === "pending" && (
          <div className="w-full text-center">
            <Loader></Loader>
          </div>
        )}
        {adjacentLocations.map(({ location, cost, through, road, owned }) => (
          <NeighborPanelListItem
            key={location}
            baseLocation={baseLocation}
            neighborLocation={location}
            cost={cost}
            computationStatus={neighborLocationResult?.status}
            through={through}
            road={road}
            owned={owned}
            isRoadBuildingMode={roadEditState.isModeEnabled}
          ></NeighborPanelListItem>
        ))}
      </div>
    </div>
  );
}
