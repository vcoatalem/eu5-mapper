import { AppContext } from "@/app/appContextProvider";
import { EditableField } from "@/app/components/editableField.component";
import { FormattedProximityWithPathfindingTooltip } from "@/app/components/formattedProximityWithPathfindingTooltip.component";
import { RoadStepper } from "@/app/components/roads/roadStepper.component";
import { ColorHelper } from "@/app/lib/drawing/color.helper";
import {
  editModeController,
  maritimeSliceFromState,
  roadSliceFromState,
} from "@/app/lib/editMode.controller";
import { gameStateController } from "@/app/lib/gameState.controller";
import { LocationsHelper } from "@/app/lib/locations.helper";
import {
  debouncedNeighborsProximityComputationController,
  neighborsProximityComputationController,
} from "@/app/lib/neighborsProximityComputation.controller";
import { RoadsHelper } from "@/app/lib/roads.helper";
import { RoadType } from "@/app/lib/types/roads";
import { validateFloatInRange } from "@/app/lib/utils/editableFieldValidation.helper";
import { StringHelper } from "@/app/lib/utils/string.helper";
import styles from "@/app/styles/button.module.css";
import {
  CSSProperties,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { ActionSource } from "../lib/actionSource.component";
import { debouncedProximityComputationController } from "../lib/proximityComputation.controller";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { GameData, LocationIdentifier } from "../lib/types/general";
import { EdgeType } from "../lib/types/pathfinding";
import { FormatedProximityCost } from "./formatedProximityCost.component";
import { Loader } from "./loader.component";
import { BiWater } from "react-icons/bi";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import Image from "next/image";
import { getVegetationIcon } from "@/app/lib/drawing/getImages";

const NeighborPanelListItemRoadMode = memo(
  function NeighborPanelListItemBuildMode({
    baseLocation,
    neighborLocation,
    gameData,
    road,
    cost,
    computationStatus,
    through,
    owned,
  }: {
    baseLocation: LocationIdentifier;
    neighborLocation: LocationIdentifier;
    gameData: GameData;
    road: RoadType | null;
    cost: number;
    computationStatus: "pending" | "completed" | "error" | "needs_update";
    through: EdgeType;
    owned: boolean;
  }) {
    const spanRef = useRef<HTMLSpanElement>(null);

    if (!gameData) {
      return null;
    }

    return (
      <ActionSource locations={() => [neighborLocation]} hover={{}}>
        <div
          key={neighborLocation}
          className={
            " flex flex-row items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded "
          }
        >
          <ActionSource
            locations={() => [neighborLocation]}
            click={{ type: "goto" }}
          >
            <span
              className={
                " truncate shrink-0 cursor-pointer flex flex-row items-center gap-1 "
              }
              ref={spanRef}
            >
              {StringHelper.formatLocationName(neighborLocation)}
              {through === "river" ? (
                <Tooltip
                  config={{
                    preferredHorizontal: "left",
                    preferredVertical: "bottom",
                  }}
                >
                  <TooltipTrigger>
                    <BiWater size={16} color="lightblue"></BiWater>
                  </TooltipTrigger>
                  <TooltipContent anchor={{ type: "dom", ref: spanRef }}>
                    <p className="max-w-54">
                      <b>{StringHelper.formatLocationName(baseLocation)}</b> and{" "}
                      <b>{StringHelper.formatLocationName(neighborLocation)}</b>{" "}
                      are connected by a river. <br />
                      Roads do not impact the flat cost of transportation
                      between them.
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <></>
              )}
            </span>
          </ActionSource>

          <span className="ml-auto">
            {["pending", "needs_update"].includes(computationStatus) && (
              <Loader size={10}></Loader>
            )}
            {computationStatus === "error" && "error"}
            {computationStatus === "completed" && (
              <FormatedProximityCost
                proximityCost={cost}
              ></FormatedProximityCost>
            )}
          </span>

          <RoadStepper
            className=""
            roadKey={RoadsHelper.buildOrderedRoadKey(
              baseLocation,
              neighborLocation,
            )}
            roadType={road}
          />
        </div>
      </ActionSource>
    );
  },
);

const NeighborPanelListItem = memo(function NeighborPanelListItem({
  baseLocation,
  neighborLocation,
  cost,
  computationStatus,
  through,
  owned,
}: {
  baseLocation: LocationIdentifier;
  neighborLocation: LocationIdentifier;
  cost: number;
  computationStatus: "pending" | "completed" | "error" | "needs_update";
  through: EdgeType;
  owned: boolean;
}) {
  return (
    <div
      key={neighborLocation}
      className={
        " grid grid-cols-5 items-center justify-between py-1 px-2 hover:bg-stone-800/50 rounded "
      }
    >
      <span
        className={
          " truncate col-span-3 cursor-pointer " +
          (!owned ? "text-stone-500 italic" : "")
        }
      >
        {StringHelper.formatLocationName(neighborLocation)}
        {!owned && <span> (unowned)</span>}
      </span>

      <span className="ml-2 col-span-1">
        {["pending", "needs_update"].includes(computationStatus) && (
          <Loader size={10}></Loader>
        )}
        {computationStatus === "error" && "error"}
        {computationStatus === "completed" && (
          <FormatedProximityCost proximityCost={cost}></FormatedProximityCost>
        )}
      </span>
      <span className="col-span-1 pl-2"> ({through})</span>
    </div>
  );
});

interface NeighborsPanelProps {
  baseLocation: LocationIdentifier;
  style?: CSSProperties;
}

export function NeighborsPanelComponent({
  baseLocation,
  style,
}: NeighborsPanelProps) {
  const gameData = useContext(AppContext).gameData;
  const locationNameRef = useRef<HTMLDivElement>(null);
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

  const editModeState = useSyncExternalStore(
    editModeController.subscribe.bind(editModeController),
    () => editModeController.getSnapshot(),
  );
  const maritimePresenceEditState = useMemo(
    () => maritimeSliceFromState(editModeState),
    [editModeState],
  );
  const roadEditState = useMemo(
    () => roadSliceFromState(editModeState),
    [editModeState],
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
      !!baseLocation &&
      (!neighborLocationResult ||
        neighborLocationResult.status === "needs_update")
    ) {
      neighborsProximityComputationController.launchGetNeighborsProximity(
        baseLocation,
      );
    }
  }, [neighborLocationResult]);

  const adjacentLocations = useMemo(
    () =>
      Object.entries(neighborLocationResult?.neighbors ?? {})
        .filter(([location, { through }]) => {
          switch (true) {
            case location === baseLocation:
              return false;
            case roadEditState.isModeEnabled:
              return through === "land" || through === "river";
            case maritimePresenceEditState.isModeEnabled:
              return (
                through === "sea" ||
                through === "lake" ||
                through === "through-sea"
              );
            default:
              return true;
          }
        })
        .map(([location, data]) => ({
          location,
          cost: data.cost,
          through: data.through,
          road: gameData
            ? RoadsHelper.getRoad(
                baseLocation,
                location,
                gameData.roads,
                gameState.roads,
              )
            : null,
          owned: gameState.ownedLocations[location] !== undefined,
        })),
    [
      neighborLocationResult,
      roadEditState,
      maritimePresenceEditState,
      gameState,
      gameData,
      baseLocation,
    ],
  );

  const locationMaritimePresence = useMemo(() => {
    if (!gameData || !gameState) {
      return -1;
    }
    if (!gameData.locationDataMap[baseLocation]) {
      return -1;
    }
    return LocationsHelper.getLocationMaritimePresence(
      gameData.locationDataMap[baseLocation],
      gameState.temporaryLocationData[baseLocation] ?? null,
    );
  }, [gameData, gameState, baseLocation]);

  if (!gameData) {
    return null;
  }

  const vegetationAtLocation =
    gameData.locationDataMap[baseLocation]?.vegetation ?? null;
  const vegetationProximityModifier = vegetationAtLocation
    ? (gameData.proximityComputationRule.vegetation?.[vegetationAtLocation]
        ?.value ?? 0)
    : 0;

  return (
    <div
      className={
        "max-h-96 min-h-52 overflow-y-auto backdrop-blur-sm px-2 py-1 " +
        (roadEditState.isModeEnabled ? " w-[400px] " : " w-[280px] ")
      }
      style={style ?? {}}
    >
      <div className="w-full flex flex-row items-center mb-2">
        <div ref={locationNameRef} className="font-semibold text-stone-300">
          {baseLocation ? StringHelper.formatLocationName(baseLocation) : ""}
        </div>

        {baseLocation in globalProximityResult.result && (
          <span className="ml-4">
            {["pending", "updating"].includes(globalProximityResult.status) && (
              <Loader size={10}></Loader>
            )}
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
        {vegetationProximityModifier && roadEditState.isModeEnabled ? (
          <Tooltip
            config={{
              preferredHorizontal: "left",
              preferredVertical: "bottom",
            }}
          >
            <TooltipTrigger>
              <Image
                className="ml-2 cursor-help"
                src={getVegetationIcon(vegetationAtLocation)}
                alt={vegetationAtLocation ?? ""}
                width={16}
                height={16}
                unoptimized
              />
            </TooltipTrigger>
            <TooltipContent anchor={{ type: "dom", ref: locationNameRef }}>
              <p className="max-w-54">
                <b>{vegetationAtLocation}</b> in{" "}
                <b>{StringHelper.formatLocationName(baseLocation)}</b> adds a{" "}
                {vegetationProximityModifier}% proximity modifier to
                destinations not connected by a road.
              </p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <></>
        )}
        {editModeState.modeEnabled !== "acquire" && (
          <button
            className={[styles.simpleButton, "ml-auto"].join(" ")}
            onClick={() => editModeController.reset()}
          >
            Done
          </button>
        )}
      </div>
      <hr className="mt-1 mb-2 border-stone-300 w-full"></hr>
      {locationMaritimePresence > -1 && (
        <>
          <div className="flex flex-row items-center gap-2 relative flex-1">
            ⚓ Maritime Presence:
            <EditableField<number>
              className="w-16"
              key={baseLocation}
              autoFocus={
                maritimePresenceEditState.isModeEnabled &&
                maritimePresenceEditState.selectedLocation === baseLocation
              }
              value={locationMaritimePresence}
              baseValue={locationMaritimePresence}
              validate={(raw) => validateFloatInRange(raw, 0, 101)}
              onValidate={(value) => {
                gameStateController.changeTemporaryLocationData(baseLocation, {
                  maritimePresence: value,
                });
              }}
              tooltip={<span>Edit maritime presence</span>}
            >
              <span
                style={{
                  color: ColorHelper.rgbToHex(
                    ...ColorHelper.getMaritimePresenceColor(
                      locationMaritimePresence,
                    ),
                  ),
                }}
              >
                {locationMaritimePresence}
              </span>
            </EditableField>
          </div>
          <hr className="mt-1 mb-2 border-stone-300 w-full"></hr>
        </>
      )}

      <div className="flex flex-col gap-1 text-xs">
        <span>Neighbors</span>
        {adjacentLocations.length === 0 &&
          computationResults?.[baseLocation]?.status === "pending" && (
            <div className="w-full text-center">
              <Loader size={10}></Loader>
            </div>
          )}
        <div className="rounded-lg bg-blue-500/20 px-2 overflow-y-scroll max-h-[200px]">
          {adjacentLocations.map(({ location, cost, through, road, owned }) =>
            roadEditState.isModeEnabled ? (
              <NeighborPanelListItemRoadMode
                key={location}
                baseLocation={baseLocation}
                neighborLocation={location}
                gameData={gameData}
                cost={cost}
                computationStatus={neighborLocationResult?.status}
                through={through}
                road={road}
                owned={owned}
              />
            ) : (
              <NeighborPanelListItem
                key={location}
                baseLocation={baseLocation}
                neighborLocation={location}
                cost={cost}
                computationStatus={neighborLocationResult?.status}
                through={through}
                owned={owned}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
