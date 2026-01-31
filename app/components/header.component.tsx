import { useContext, useMemo, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "../lib/gameState.controller";
import { WorkerStatusComponent } from "./workerStatus.component";

export function HeaderComponent() {
  const { gameData } = useContext(AppContext);
  if (!gameData) return;
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const selectCountry = (code: string) => {
    console.log("select country:", code);
    gameStateController.reset(code);
  };

  return (
    <div className="w-full h-10 flex">
      <WorkerStatusComponent />
      <select
        className="ml-auto"
        value={gameState.countryCode || ""}
        onChange={(e) => selectCountry(e.target.value)}
      >
        <option value="" disabled>
          Custom Country
        </option>
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
