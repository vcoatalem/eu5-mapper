import { useContext, useSyncExternalStore } from "react";
import { gameStateController } from "@/app/lib/gameStateController";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationIdentifier,
} from "../lib/types/general";
import { ConstructibleHelper } from "../lib/constructible.helper";
import { AppContext } from "../appContextProvider";
import { getGuiImage } from "../lib/drawing/namedGuiImagesMap.const";

const capitalPicker = (
  location: ILocationIdentifier,
  isCapital: boolean,
): React.JSX.Element => {
  return (
    <div className={"bg-white ml-1"}>
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
        .map((building) => {
          return (
            <span
              key={building.name}
              className={
                building.reason === "limit" ? "backdrop-grayscale-50" : ""
              }
            >
              <img
                src={getGuiImage(building.name)}
                alt={building.name}
                width={24}
                height={24}
              />
            </span>
          );
        })}
    </div>
  );
};

const locationRankPicker = (
  locationName: ILocationIdentifier,
  constructible: IConstructibleLocation,
) => {
  return (
    <div className="ml-2 flex flex-row space-x-1">
      {(["rural", "town", "city"] as IConstructibleLocation["level"][]).map(
        (rank) => (
          <button
            key={rank}
            disabled={constructible.level === rank}
            className={
              constructible.level === rank
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

export function ConstructibleMenusComponent() {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  const { gameData, setHoveredLocation } = useContext(AppContext);
  if (!gameData) {
    throw new Error(
      "[ConstructibleMenusComponent]: need gameData in context to render",
    );
  }

  /*  console.log("ConstructibleMenusComponent render"); */
  return (
    <div className="min-h-96 w-40 hover:w-[600px] overflow-y-auto overflow-x-hidden max-h-[50vh] transition-[width] duration-300 ease-in-out">
      {Object.entries(gameState.ownedLocations).map(
        ([locationName, constructibleData]) => (
          <div
            key={locationName}
            className="py-1 h-8 flex flex-row items-center whitespace-nowrap"
            onMouseEnter={() => setHoveredLocation(locationName)}
            onMouseLeave={() => setHoveredLocation(null)}
          >
            <div className="font-bold w-32 truncate ... flex-none">
              <span className="text-md ">{locationName}</span>
            </div>
            {capitalPicker(
              locationName,
              gameState.capitalLocation === locationName,
            )}
            {locationRankPicker(locationName, constructibleData)}
            {buildingList(
              locationName,
              gameData,
              gameState.ownedLocations,
              constructibleData,
            )}
          </div>
        ),
      )}
    </div>
  );
}
