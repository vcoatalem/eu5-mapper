import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { gameStateController } from "@/app/lib/gameState.controller";
import { IGameData, ILocationIdentifier } from "../lib/types/general";
import { AppContext } from "../appContextProvider";
import {
  IProximityComputationResults,
  proximityComputationController,
} from "../lib/proximityComputation.controller";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { ActionSource } from "@/app/lib/actionSource.component";
import { FoldableMenu } from "./foldableMenu.component";
import { FormattedProximityWithPathfindingTooltip } from "@/app/components/formattedProximityWithPathfindingTooltip.component";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { IoSearch } from "react-icons/io5";
import { IConstructibleLocation } from "@/app/lib/types/constructibleLocation";
import { IGameState } from "@/app/lib/types/gameState";

const SimpleLocationListItem = React.memo(function SimpleLocationListItem({
  location,
  gameState,
  proximityComputation,
}: {
  location: ILocationIdentifier;
  constructible: IConstructibleLocation;
  gameData: IGameData;
  gameState: IGameState;
  proximityComputation: IProximityComputationResults;
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
          locations={() => [location]}
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
  const { gameData } = useContext(AppContext);

  const [search, setSearch] = useState("");
  const [ownedLocationsExpanded, setOwnedLocationsExpanded] =
    useState<boolean>(false);

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

  // Auto-expand when search has results
  // This is a legitimate side effect: syncing UI state (expansion) with user input (search)
  useEffect(() => {
    if (search && filteredLocationEntries.length > 0) {
      setOwnedLocationsExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLocationEntries.length]);

  if (!gameData) {
    return <div>Loading gameData</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {noOwnedLoactions ? (
        <div className="text-stone-400 text-italic">
          No locations selected - either select a country above, or create your
          own country from scratch by selecting a location
        </div>
      ) : (
        <>
          <div className="shrink-0 flex flex-row pt-1 items-center">
            <IoSearch color="white" size={16}></IoSearch>
            <input
              type="search"
              placeholder="Search for a location..."
              className="w-full ml-2"
              onChange={(e) => setSearch(e.target.value)}
              style={{ outline: "none" }}
            />
          </div>
          <hr className="w-full my-2 shrink-0" />
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-none">
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
          </div>
        </>
      )}
    </div>
  );
}
