import { useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "../lib/gameState.controller";
import { WorkerStatusComponent } from "./workerStatus.component";
import { LocationSearchBar } from "./locationSearchBar.component";

export function HeaderComponent() {

  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const { gameData } = useContext(AppContext);
  if (!gameData) return;

  const selectCountry = (code: string) => {
    gameStateController.reset(code);
  };

  return (
    <div className="w-full h-10 flex divide-x-2 divide-stone-60">
      <WorkerStatusComponent />
      <LocationSearchBar />
      <select
        className="ml-auto"
        value={gameState.countryCode || ""}
        onChange={(e) => selectCountry(e.target.value)}
      >
        <option value="" disabled>
          Custom Country
        </option>
        {Object.entries(gameData?.countriesDataMap).map(
          ([countryName]) => (
            <option key={countryName} value={countryName}>
              {countryName}
            </option>
          ),
        )}
      </select>
    </div>
  );
}
