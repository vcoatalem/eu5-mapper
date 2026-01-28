import { useSyncExternalStore } from "react";
import { gameStateController } from "@/app/lib/gameStateController";
import { ILocationIdentifier } from "../lib/types/general";

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

export function ConstructibleMenusComponent() {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  console.log("ConstructibleMenusComponent render");
  return (
    <div className="min-h-96 w-96 overflow-y-auto max-h-[50vh]">
      {Object.entries(gameState.ownedLocations).map(
        ([locationName, constructibleData]) => (
          <div key={locationName} className="py-1 flex flex-row">
            <div className="font-bold w-32 truncate ... flex-none">
              <span className="text-md ">{locationName}</span>
            </div>
            {capitalPicker(
              locationName,
              gameState.capitalLocation === locationName,
            )}
          </div>
        ),
      )}
    </div>
  );
}
