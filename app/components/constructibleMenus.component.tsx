import React, {
  useContext,
  useEffect,
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
import { getGuiImage } from "../lib/drawing/namedGuiImagesMap.const";
import { proximityComputationController } from "../lib/proximityComputation.controller";
import { ColorHelper } from "../lib/drawing/color.helper";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";

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
                if (!building.canBuild) {
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
  function constructibleLocationItem({
    location,
    constructible,
    gameData,
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
        <div className="col-span-2 flex flex-row items-center space-x-2">
          {capitalPicker(location, gameState.capitalLocation === location)}
          {locationRankPicker(location, constructible)}
        </div>
        <div className="col-span-1">
          {buildingList(
            location,
            gameData,
            gameState.ownedLocations,
            constructible,
          )}
        </div>
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
  const { gameData } = useContext(AppContext);

  const [search, setSearch] = useState("");
  if (!gameData) {
    throw new Error(
      "[ConstructibleMenusComponent]: need gameData in context to render",
    );
  }

  return (
    <div className="min-h-96 w-52 hover:w-[600px] overflow-y-auto overflow-x-hidden max-h-[50vh] transition-[width] duration-300 ease-in-out">
      <input
        type="search"
        placeholder="Search for a location..."
        className="w-full"
        onChange={(e) => setSearch(e.target.value)}
        style={{ outline: "none" }}
      />
      <hr className="w-full"></hr>
      {Object.entries(gameState.ownedLocations)
        .filter(([locationName]) =>
          locationName.toLowerCase().includes(search.toLowerCase()),
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
    </div>
  );
}
