import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ModalInstanceContext } from "@/app/lib/modal/modal.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { AppContext } from "../appContextProvider";
import { CountryStats } from "./countryStatsComponent";
import {
  IConstructibleLocation,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
  ITemporaryLocationData,
} from "../lib/types/general";
import { DetailedLocationList } from "./detailedLocationList.component";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { proximityComputationController } from "@/app/lib/proximityComputation.controller";
import { NewConstructibleState } from "@/app/lib/types/building";
import { ConstructibleHelper } from "@/app/lib/constructible.helper";
import { IoSearch } from "react-icons/io5";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";

function LocationExtensiveViewModalHeader(props: {
  countryName: string | null;
  ownedLocations: IGameState["ownedLocations"];
  search?: string;
  setSearch?: (search: string) => void;
}) {
  return (
    <div className="w-full flex flex-row items-center border-b border-white h-12 pb-2">
      <>
        <span>Locations</span>
        {props.countryName && (
          <span className="ml-1">
            {" "}
            of{" "}
            <span className="text-yellow-500 text-bold">
              {props.countryName}
            </span>
          </span>
        )}
      </>

      <div className="flex flex-row items-center gap-1 ml-16">
        <IoSearch color="white" size={16}></IoSearch>
        <input
          type="text"
          placeholder="Search for a location..."
          value={props.search ?? ""}
          onChange={(e) => props.setSearch && props.setSearch?.(e.target.value)}
          style={{ outline: "none" }}
        ></input>
      </div>

      <CountryStats
        className="ml-auto border-stone-500 border rounded-md px-2 py-1 items-center flex-none"
        ownedLocations={props.ownedLocations}
      ></CountryStats>
    </div>
  );
}

export interface ILocationDetailedViewData {
  constructibleData: IConstructibleLocation;
  temporaryLocationData: ITemporaryLocationData;
  baseLocationGameData: ILocationGameData;
  pinned?: boolean;
  proximity: number | null;
  constructibleState: NewConstructibleState;
}

export function DetailedLocationViewModal() {
  const modalInstanceContext = useContext(ModalInstanceContext);
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
  const gameData = useContext(AppContext).gameData;
  if (!modalInstanceContext) {
    throw new Error(
      "[DetailedLocationViewModal] must be used within a ModalInstanceContext provider",
    );
  }

  const [search, setSearch] = useState<string>("");
  const [pinnedLocations, setPinnedLocations] = useState<
    Set<ILocationIdentifier>
  >(new Set());

  const togglePin = useCallback(
    (location: ILocationIdentifier) => {
      setPinnedLocations((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(location)) {
          newSet.delete(location);
        } else {
          newSet.add(location);
        }
        return newSet;
      });
    },
    [pinnedLocations],
  );

  // TODO: optimize this ^^
  const ownedLocations: Record<ILocationIdentifier, ILocationDetailedViewData> =
    useMemo(() => {
      const temporaryLocationData = gameState.temporaryLocationData;
      const proximityComputed = !!Object.keys(proximityComputation.result)
        .length;

      return Object.fromEntries(
        Object.entries(gameState.ownedLocations)
          .map(([key, value]) => {
            const locationGameData = gameData?.locationDataMap[key];
            /* console.log({ locationGameData }); */
            if (!locationGameData) {
              throw new Error(
                "[DetailedLocationViewModal] location game data not found for location id: " +
                  key,
              );
            }
            return [
              key,
              {
                constructibleData: value,
                temporaryLocationData: temporaryLocationData[key] ?? {},
                baseLocationGameData: locationGameData,
                constructibleState: ConstructibleHelper.getNewConstructibleState(key, gameData, gameState),
                pinned: pinnedLocations.has(key),
                proximity: ProximityComputationHelper.evaluationToProximity(
                  proximityComputation.result[key]?.cost ?? 100,
                ),
              },
            ] as [string, ILocationDetailedViewData];
          })
          .filter(([key, value]) => {
            if (value.pinned) {
              return true;
            }
            return StringHelper.isInSearchQuery(key, search);
          }),
      );
    }, [
      gameData,
      gameState,
      pinnedLocations,
      proximityComputation,
      search,
    ]);

  return (
    <div className="h-[80vh] w-[85vw] flex flex-col overflow-x-hidden">
      <LocationExtensiveViewModalHeader
        countryName={gameState.country?.templateData?.name ?? null}
        ownedLocations={gameState.ownedLocations}
        search={search}
        setSearch={setSearch}
      ></LocationExtensiveViewModalHeader>
      <DetailedLocationList
        capitalLocation={gameState.capitalLocation ?? null}
        ownedLocations={ownedLocations}
        togglePin={togglePin}
      ></DetailedLocationList>
    </div>
  );
}
