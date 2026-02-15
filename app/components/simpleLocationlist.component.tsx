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
} from "../lib/types/general";
import { ConstructibleHelper } from "../lib/constructible.helper";
import { AppContext } from "../appContextProvider";
import { proximityComputationController } from "../lib/proximityComputation.controller";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { ActionSource } from "@/app/lib/actionSource.component";
import { FoldableMenu } from "./foldableMenu.component";
import { roadBuilderController } from "../lib/roadBuilderController";
import Image from "next/image";
import { FormattedProximityWithPathfindingTooltip } from "@/app/components/formattedProximityWithPathfindingTooltip.component";
import { StringHelper } from "@/app/lib/utils/string.helper";

const SimpleLocationListItem = React.memo(function SimpleLocationListItem({
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
});

export function SimpleLocationList() {
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
                  <SimpleLocationListItem
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
