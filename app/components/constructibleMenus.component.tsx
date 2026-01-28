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
import { getBuildingImage } from "../lib/drawing/buildingsImageMap.const";

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
                src={getBuildingImage(building.name)}
                alt={building.name}
                width={16}
                height={16}
              />
            </span>
          );
        })}
    </div>
  );
};

export function ConstructibleMenusComponent() {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  const { gameData } = useContext(AppContext);
  if (!gameData) {
    throw new Error(
      "[ConstructibleMenusComponent]: need gameData in context to render",
    );
  }

  /*  console.log("ConstructibleMenusComponent render"); */
  return (
    <div className="min-h-96 w-96 overflow-y-auto max-h-[50vh]">
      {Object.entries(gameState.ownedLocations).map(
        ([locationName, constructibleData]) => (
          <div key={locationName} className="py-1 flex flex-row items-center">
            <div className="font-bold w-32 truncate ... flex-none">
              <span className="text-md ">{locationName}</span>
            </div>
            {capitalPicker(
              locationName,
              gameState.capitalLocation === locationName,
            )}
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
