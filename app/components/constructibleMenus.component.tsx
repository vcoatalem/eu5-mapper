import React, {
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { gameStateController } from "@/app/lib/gameState.controller";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationIdentifier,
  RoadType,
} from "../lib/types/general";
import { ConstructibleHelper } from "../lib/constructible.helper";
import { AppContext } from "../appContextProvider";
import { getGuiImage } from "../lib/drawing/namedGuiImagesMap.const";
import { proximityComputationController } from "../lib/proximityComputation.controller";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { ActionSource } from "@/app/lib/actionSource.component";
import { FoldableMenu } from "./foldableMenu.component";
import { ExpandablePanel } from "./expandablePanel.component";
import { roadBuilderController } from "../lib/roadBuilderController";
import { Tooltip } from "../lib/tooltip/tooltip.component";
import { TooltipTrigger } from "../lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "../lib/tooltip/tooltipContent.component";
import { ShortestPathComponent } from "./shortestPath.component";
import { FormatedProximity } from "./formatedProximity.component";
import { RoadList } from "./roadList.component";
import Image from "next/image";
import { FormattedProximityWithPathfindingTooltip } from "@/app/components/formattedProximityWithPathfindingTooltip.component";
import { StringHelper } from "@/app/lib/utils/string.helper";

function CapitalPicker(props: {
  location: ILocationIdentifier;
  isCapital: boolean;
}) {
  return (
    <div className={"bg-white ml-1 w-4"}>
      <button
        onClick={() => {
          gameStateController.changeCapital(props.location);
        }}
        className={
          "px-1" +
          (props.isCapital
            ? " bg-black text-yellow-300"
            : " bg-white text-black hover:bg-yellow-400")
        }
      >
        ★
      </button>
    </div>
  );
}

const buildingList = (
  locationName: ILocationIdentifier,
  gameData: IGameData,
  ownedLocations: IGameState["ownedLocations"],
  constructible: IConstructibleLocation,
) => {
  const state = ConstructibleHelper.getConstructibleState(
    locationName,
    constructible,
    gameData,
    ownedLocations,
  );
  return (
    <div className="flex flex-row space-x-2 ml-2">
      {state.buildings
        .filter((building) => building.canBuild || building.reason === "limit")
        .map((building) => (
          <div key={building.name} className="inline-block">
            <button
              className={
                "relative flex items-center justify-center " +
                (building.canBuild
                  ? "hover:bg-yellow-400 "
                  : "backdrop-grayscale-50 ") +
                (building.amountBuilt > 0 ? "bg-yellow-300 " : "") +
                (building.amountBuilt > 0 && !building.canBuild
                  ? " hover:bg-red-500 "
                  : "")
              }
              onClick={() => {
                if (!building.canBuild && building.amountBuilt > 0) {
                  gameStateController.removeBuildingFromLocation(
                    locationName,
                    building.name,
                  );
                } else {
                  gameStateController.addBuildingToLocation(
                    locationName,
                    building.name,
                  );
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                gameStateController.removeBuildingFromLocation(
                  locationName,
                  building.name,
                );
              }}
              style={{ width: 32, height: 32, padding: 0 }}
            >
              <img
                src={getGuiImage(building.name)}
                alt={building.name}
                width={24}
                height={24}
                style={{ display: "block" }}
              />
              {building.amountBuilt > 0 && (
                <span
                  className="absolute left-0 bottom-0 mb-0.5 ml-0.5 px-1 py-0 text-xs font-bold text-black bg-white/70 backdrop-blur-sm rounded z-10"
                  style={{
                    pointerEvents: "none",
                    fontSize: "0.75rem",
                    minWidth: 16,
                    minHeight: 16,
                    lineHeight: "16px",
                    textAlign: "center",
                  }}
                >
                  {building.amountBuilt}
                </span>
              )}
            </button>
          </div>
        ))}
    </div>
  );
};

const locationRankPicker = (
  locationName: ILocationIdentifier,
  constructible: IConstructibleLocation,
) => {
  return (
    <div className="ml-2 flex flex-row space-x-1">
      {(["rural", "town", "city"] as IConstructibleLocation["rank"][]).map(
        (rank) => (
          <button
            key={rank}
            disabled={constructible.rank === rank}
            className={
              constructible.rank === rank
                ? `disabled:backdrop-grayscale-75 bg-yellow-300`
                : `bg-black hover:bg-yellow-400`
            }
            onClick={() =>
              gameStateController.changeLocationRank(locationName, rank)
            }
          >
            <img
              className="p-1"
              src={getGuiImage(rank)}
              alt={rank}
              width={24}
              height={24}
            ></img>
          </button>
        ),
      )}
    </div>
  );
};

const ConstructibleLocationItem = React.memo(
  function ConstructibleLocationItem({
    location,
    gameState,
    proximityComputation,
  }: {
    location: ILocationIdentifier;
    constructible: IConstructibleLocation;
    gameData: IGameData;
    gameState: IGameState;
    proximityComputation: ReturnType<
      typeof proximityComputationController.getSnapshot
    >;
  }) {
    return (
      <div
        key={location}
        className="py-1 h-10 grid grid-cols-3 items-center whitespace-nowrap gap-2 "
      >
        <div className="col-span-2 flex flex-row items-center">
          {gameState.capitalLocation === location && (
            <span className="mr-1">★</span>
          )}
          <ActionSource
            locations={(e) => location}
            hover={{}}
            click={{ type: "goto" }}
          >
            <span className=" text-lg cursor-pointer truncate ... ">
              {StringHelper.formatLocationName(location)}
            </span>
          </ActionSource>
        </div>

        <FormattedProximityWithPathfindingTooltip
          className="col-span-1"
          location={location}
          proximity={ProximityComputationHelper.evaluationToProximity(
            proximityComputation.result[location]?.cost ?? 100,
          )}
        ></FormattedProximityWithPathfindingTooltip>
      </div>
    );
  },
);

export function ConstructibleMenusComponent() {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  const proximityComputation = useSyncExternalStore(
    proximityComputationController.subscribe.bind(
      proximityComputationController,
    ),
    () => proximityComputationController.getSnapshot(),
  );
  const buildingRoadState = useSyncExternalStore(
    roadBuilderController.subscribe.bind(roadBuilderController),
    () => roadBuilderController.getSnapshot(),
  );
  const { gameData } = useContext(AppContext);

  const [search, setSearch] = useState("");
  const [ownedLocationsExpanded, setOwnedLocationsExpanded] =
    useState<boolean>(false);
  const [roadsExpanded, setRoadsExpanded] = useState<boolean>(false);

  const ownedLocationKeys = Object.keys(gameState?.ownedLocations ?? {});
  const noOwnedLoactions = useMemo(
    () => ownedLocationKeys.length === 0,
    [ownedLocationKeys.length],
  );
  const filteredLocationEntries = useMemo(() => {
    const entries = Object.entries(gameState?.ownedLocations ?? {});
    if (!search) {
      return entries;
    }
    const searchLower = search.toLowerCase();
    return entries.filter(([locationName]) =>
      locationName.toLowerCase().includes(searchLower),
    );
  }, [search, gameState.ownedLocations, ownedLocationKeys.length]);

  const filteredRoadsEntries = useMemo(() => {
    const entries = ConstructibleHelper.getOwnedRoads(
      gameState?.ownedLocations ?? {},
      gameState?.roads ?? {},
    );
    if (!search) {
      return entries;
    }
    const searchLower = search.toLowerCase();

    for (const [key] of Object.entries(entries)) {
      const [from, to] = key.split("-");
      const fromContains = from.toLowerCase().includes(searchLower);
      const toContains = to.toLowerCase().includes(searchLower);
      const fromScore = fromContains ? searchLower.length / from.length : 0;
      const toScore = toContains ? searchLower.length / to.length : 0;
      const keyMatched: "from" | "to" = fromScore >= toScore ? "from" : "to";

      if (!key.toLowerCase().includes(searchLower)) {
        delete entries[key as keyof typeof entries];
      } else if (keyMatched === "to") {
        const type = entries[key];
        delete entries[key];
        const newKey = `${to}-${from}`;
        entries[newKey] = type;
      }
    }
    return entries;
  }, [
    search,
    gameState.ownedLocations,
    gameState.roads,
    ownedLocationKeys.length,
  ]);

  // Auto-expand when search has results
  // This is a legitimate side effect: syncing UI state (expansion) with user input (search)
  useEffect(() => {
    if (search && filteredLocationEntries.length > 0) {
      setOwnedLocationsExpanded(true);
    }
    if (search && Object.keys(filteredRoadsEntries).length > 0) {
      setRoadsExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLocationEntries.length, filteredRoadsEntries]);

  if (!gameData) {
    return <div>Loading gameData</div>;
  }

  return (
    <div>
      {noOwnedLoactions ? (
        <div className="text-stone-400 text-italic">
          No locations selected - either select a country above, or create your
          own country from scratch by selecting a location
        </div>
      ) : (
        <>
          <div className="shrink-0 flex flex-row pt-1">
            <Image
              src={"/icons/magnifyingGlass.svg"}
              alt="search"
              width={16}
              height={16}
              className="invert"
            />
            <input
              type="search"
              placeholder="Search for a location..."
              className="w-full ml-2"
              onChange={(e) => setSearch(e.target.value)}
              style={{ outline: "none" }}
            />
          </div>
          <hr className="w-full my-2"></hr>
          <div className="flex-1 min-h-0 overflow-x-hidden">
            <FoldableMenu
              title={`Owned Locations (${Object.keys(gameState.ownedLocations).length})`}
              isExpanded={ownedLocationsExpanded}
              onToggle={() =>
                setOwnedLocationsExpanded(!ownedLocationsExpanded)
              }
            >
              {filteredLocationEntries
                .sort(
                  ([a], [b]) =>
                    (proximityComputation.result[a]?.cost ?? 100) -
                    (proximityComputation.result[b]?.cost ?? 100),
                )
                .map(([locationName, constructibleData]) => (
                  <ConstructibleLocationItem
                    key={locationName}
                    location={locationName}
                    constructible={constructibleData}
                    gameData={gameData}
                    gameState={gameState}
                    proximityComputation={proximityComputation}
                  />
                ))}
            </FoldableMenu>
            {/*     <FoldableMenu
              title={`Owned Roads (${Object.keys(gameState.roads).length})`}
              isExpanded={roadsExpanded}
              onToggle={() => setRoadsExpanded(!roadsExpanded)}
            >
              <div className="gap-4 w-[600px]">
                <button
                  className={
                    " text-black rounded-lg px-3 py-2 " +
                    (buildingRoadState.isBuildingModeEnabled
                      ? " bg-yellow-600 hover:bg-yellow-500 "
                      : " bg-blue-600 hover:bg-blue-500 ")
                  }
                  onClick={() => roadBuilderController.toggleBuildingMode()}
                >
                  Build new roads
                </button>
              </div>

              {buildingRoadState.isBuildingModeEnabled && (
                <div className="text-sm text-yellow-400 italic mb-2 mr-3">
                  Click on a location to start building a new road
                </div>
              )}

              <RoadList search={search}></RoadList>
            </FoldableMenu> */}
          </div>
        </>
      )}
    </div>
  );
}
