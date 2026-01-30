import { useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "../lib/gameState.controller";

export function HeaderComponent() {
  const { gameData } = useContext(AppContext);
  if (!gameData) return;
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot,
  );
  return (
    <div className="w-full h-10 flex">
      <select className="ml-auto">
        {Object.entries(gameData?.countriesDataMap).map(
          ([countryName, countryData]) => (
            <option key={countryName} value={countryName}>
              {countryName}
            </option>
          ),
        )}
      </select>
    </div>
  );
}
