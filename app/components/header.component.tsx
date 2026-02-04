import { useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "../lib/gameState.controller";
import { WorkerStatusComponent } from "./workerStatus.component";
import { LocationSearchBar } from "./locationSearchBar.component";
import { PathfindingInfosComponent } from "@/app/components/pathfindingInfos.component";

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
    <div className="w-full h-10 flex items-center">
      <WorkerStatusComponent />
      <LocationSearchBar />
      <select
        className="font-bold hover:bg-stone-600 px-2 py-1 rounded-sm"
        style={{ appearance: "none" }}
        value={gameState.countryCode || ""}
        onChange={(e) => selectCountry(e.target.value)}
      >
        <option className="" value="">
          Select a country
        </option>

        {Object.entries(gameData?.countriesDataMap).map(
          ([countryName]) => (
            <option key={countryName} value={countryName}>
              {countryName}
            </option>
          ),
        )}
      </select>
      <PathfindingInfosComponent className="ml-auto"/>
    </div>
  );
}
