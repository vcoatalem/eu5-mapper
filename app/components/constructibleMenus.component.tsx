import React, {
  useContext,
  useEffect,
  useMemo,
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
import { ColorHelper } from "../lib/drawing/color.helper";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";
import { FoldableMenu } from "./foldableMenu.component";
import { ExpandablePanel } from "./expandablePanel.component";

const capitalPicker = (
  location: ILocationIdentifier,
  isCapital: boolean,
): React.JSX.Element => {
  return (
    <div className={"bg-white ml-1 w-4"}>
      <button
        onClick={() => {
          gameStateController.changeCapital(location);
        }}
        className={
          "px-1" +
          (isCapital
            ? " bg-black text-yellow-300"
            : " bg-white text-black hover:bg-yellow-400")
        }
      >
        ★
      </button>
    </div>
  );
};

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
    constructible,
    gameData,
    gameState,
    proximityComputation,
    expanded,
  }: {
    location: ILocationIdentifier;
    constructible: IConstructibleLocation;
    gameData: IGameData;
    gameState: IGameState;
    proximityComputation: ReturnType<
      typeof proximityComputationController.getSnapshot
    >;
    expanded: boolean;
  }) {
    const locationNameDivRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = locationNameDivRef.current;
      if (el) {
        console.log("[ConstructibleLocationItem] registering action sources");
        actionEventDispatcher.registerHoverActionSource(el, () => location);
        actionEventDispatcher.registerClickActionSource(
          el,
          () => location,
          "goto",
        );
      }
      return () => {
        if (el) {
          console.log(
            "[ConstructibleLocationItem] unregistering action sources",
          );
          actionEventDispatcher.clearEventListenersForElement(el);
        }
      };
      // Note: expanded is intentionally NOT in the dependency array
      // to prevent re-registering actions when menu expands/collapses
    }, [location]);

    return (
      <div
        key={location}
        className="py-1 h-10 grid grid-cols-9 items-center whitespace-nowrap gap-2 w-[600px]"
      >
        <div
          className="font-bold col-span-2 truncate ... flex-none cursor-pointer"
          ref={locationNameDivRef}
        >
          <span className="text-lg ">{location}</span>
        </div>
        <span
          className="col-span-1"
          style={{
            color: ColorHelper.rgbToHex(
              ...ColorHelper.getEvaluationColor(
                proximityComputation.result[location]?.cost ?? 100,
              ),
            ),
          }}
        >
          {ProximityComputationHelper.evaluationToProximity(
            proximityComputation.result[location]?.cost,
          ) ?? 0}
        </span>
        {
          expanded && (
            <div className="col-span-2 flex flex-row items-center space-x-2">
              {capitalPicker(location, gameState.capitalLocation === location)}
              {locationRankPicker(location, constructible)}
            </div>
          )
        }
        {
          expanded && (
            <div className="col-span-1">
              {buildingList(
                location,
                gameData,
                gameState.ownedLocations,
                constructible,
              )}
            </div>
          )
        }
      </div>
    );
  },
);

const RoadItem = React.memo(function RoadItem({ roadKey, type, expanded }: { roadKey: `${string}-${string}`; type: RoadType; expanded: boolean }) {
  const [from, to] = roadKey.split('-');
  const roadKeyElementRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    const el = roadKeyElementRef.current;
    if (el) {
      console.log("[RoadItem] registering action sources");
      actionEventDispatcher.registerHoverActionSource(el, () => [from, to]);
      actionEventDispatcher.registerClickActionSource(el, () => from, "goto");
    }
    return () => {
      if (el) {
        console.log(
          "[RoadItem] unregistering action sources",
        );
        actionEventDispatcher.clearEventListenersForElement(el);
      }
    };
    // Note: expanded is intentionally NOT in the dependency array
    // to prevent re-registering actions when menu expands/collapses
  }, [roadKey]);

  if (!from || !to) {
    return <></>;
  }
  return (
    <div key={roadKey} className="py-1 h-10 grid grid-cols-8 items-center whitespace-nowrap gap-4 w-[600px]">
      <span ref={roadKeyElementRef} className={"  min-w-0 cursor-pointer truncate ... " + (expanded ? 'col-span-4' : 'col-span-2')}>
        {from} - {to}
      </span>

      {
        !expanded && (
          <span className="col-span-1">
            <img src={getGuiImage(type)} alt={type} width={24} height={24} />
          </span>
        )
      }
      {
        expanded && (
          <div className="col-span-3 flex flex-row items-center gap-2">
            {
              (["gravel_road", "paved_road", "modern_road", "rail_road"] satisfies RoadType[]).map((possibleRoadType) => (
                <button key={possibleRoadType}
                  onClick={() => {
                    gameStateController.changeRoadType(roadKey, possibleRoadType);
                  }}
                  className={`${type === possibleRoadType ? "bg-yellow-300" : "bg-black hover:bg-yellow-400"}`}
                >
                  <img src={getGuiImage(possibleRoadType)} alt={possibleRoadType} width={24} height={24} />
                </button>
              ))
            }
          </div>
        )
      }

    </div>
  );
});

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
  const { gameData } = useContext(AppContext);

  const [search, setSearch] = useState("");
  const [ownedLocationsExpanded, setOwnedLocationsExpanded] = useState<boolean>(false);
  const [roadsExpanded, setRoadsExpanded] = useState<boolean>(false);

  const ownedLocationKeys = Object.keys(gameState?.ownedLocations ?? {});
  const filteredLocationEntries = useMemo(
    () => {
      const entries = Object.entries(gameState?.ownedLocations ?? {});
      if (!search) {
        return entries;
      }
      const searchLower = search.toLowerCase();
      return entries.filter(([locationName]) =>
        locationName.toLowerCase().includes(searchLower)
      );
    },
    [search, gameState.ownedLocations, ownedLocationKeys.length],
  );

  const filteredRoadsEntries = useMemo(() => {
    const entries = ConstructibleHelper.getOwnedRoads(gameState?.ownedLocations ?? {}, gameState?.roads ?? {});
    if (!search) {
      return entries;
    }
    const searchLower = search.toLowerCase();


    for (const [key] of Object.entries(entries)) {
      const [from, to] = key.split('-');
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
  }, [search, gameState.ownedLocations, gameState.roads, ownedLocationKeys.length])

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
    <ExpandablePanel>
      {(isExpanded) => (
        <>
          {!(gameState?.ownedLocations) || Object.keys(gameState.ownedLocations).length === 0 ? <div className="text-stone-400 text-italic">No locations selected - either select a country above, or create your own country from scratch by selecting a location</div> : (
            <>
              <div className="flex-shrink-0">
                <input
                  type="search"
                  placeholder="Search for a location..."
                  className="w-full"
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ outline: "none" }}
                />
                <hr className="w-full"></hr>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
                <FoldableMenu
                  title={`Owned Locations (${Object.keys(gameState.ownedLocations).length})`}
                  isExpanded={ownedLocationsExpanded}
                  onToggle={() => setOwnedLocationsExpanded(!ownedLocationsExpanded)}
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
                        expanded={isExpanded}
                      />
                    ))}
                </FoldableMenu>
                <FoldableMenu
                  title={`Owned Roads (${Object.keys(filteredRoadsEntries).length})`}
                  isExpanded={roadsExpanded}
                  onToggle={() => setRoadsExpanded(!roadsExpanded)}
                >
                  {isExpanded && (
                  <div className="grid grid-cols-8 gap-4 w-[600px] items-center py-1 h-10">
                    <span className="col-span-4" aria-hidden />
                    <div className="col-span-3 flex flex-row items-center gap-2">
                      {
                        (["gravel_road", "paved_road", "modern_road", "rail_road"] satisfies RoadType[]).map((possibleRoadType) => (
                          <input
                            key={possibleRoadType}
                            type="checkbox"
                            className="w-6 h-6 shrink-0"
                            checked={ConstructibleHelper.areAllOwnedRoadsOfType(
                              gameState.ownedLocations,
                              gameState.roads,
                              possibleRoadType,
                            )}
                            onChange={() => gameStateController.changeAllOwnedRoadsToType(possibleRoadType)}
                          />
                        ))
                      }
                    </div>
                  </div>
                  )}
                  {filteredRoadsEntries && Object.entries(filteredRoadsEntries)
                    .sort(([keyA,], [keyB,]) => keyA.localeCompare(keyB))
                    .map(([key, type]) => (
                      <RoadItem key={key} roadKey={key as `${string}-${string}`} type={type} expanded={isExpanded} />
                    ))}
                </FoldableMenu>
              </div>
            </>
          )}
        </>
      )}
    </ExpandablePanel>
  );
}
