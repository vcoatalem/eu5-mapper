import { useSyncExternalStore } from "react";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ICountryValues } from "../lib/types/general";

const updateValue = (
  event: { target: { value: number } },
  value: keyof ICountryValues,
) => {
  console.log("slider event:", event, event.target.value);
  gameStateController.changeCountryValues({ [value]: event.target.value });
};

export function CountryOverview() {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  return (
    <div>
      <p className="font-bold">{gameState.countryCode}</p>
      <div className="grid grid-cols-3 gap-2">
        <span>Land</span>
        <input
          type="range"
          min={-100}
          max={100}
          value={gameState.country.landVsNaval}
          onChange={(e) => updateValue(e, "landVsNaval")}
        />
        <span>Naval</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <span>Centralization</span>
        <input
          type="range"
          min={-100}
          max={100}
          value={gameState.country.centralizationVsDecentralization}
          onChange={(e) => updateValue(e, "centralizationVsDecentralization")}
        />
        <span>Decentralization</span>
      </div>
      <div className="grid grid-cols-3 text-center gap-2">
        <span>Administrative Ability</span>
        <input
          type="range"
          min={0}
          max={100}
          value={gameState.country.rulerAdministrativeAbility}
          onChange={(e) => updateValue(e, "rulerAdministrativeAbility")}
        />
        <span>100</span>
      </div>
    </div>
  );
}
