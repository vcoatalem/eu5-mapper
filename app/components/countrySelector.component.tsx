import { useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "../lib/gameState.controller";

export function CountrySelector() {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const { gameData } = useContext(AppContext);
  if (!gameData) return null;

  const countryNames = Object.keys(gameData.countriesDataMap);

  return (
    <select
      className="font-bold hover:bg-stone-600 px-2 py-1 rounded-sm text-center"
      style={{ appearance: "none" }}
      value={gameState.countryCode || ""}
      onChange={(e) => gameStateController.reset(e.target.value)}
    >
      <option className="" value="">
        Select a country
      </option>

      {countryNames.map((countryName) => (
        <option key={countryName} value={countryName}>
          {countryName}
        </option>
      ))}
    </select>
  );
}
