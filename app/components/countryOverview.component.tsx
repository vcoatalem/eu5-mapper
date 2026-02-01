import React, { useContext, useSyncExternalStore } from "react";
import { gameStateController } from "@/app/lib/gameState.controller";
import {
  ICountryValues,
  IGameData,
  IGameState,
  ILocationIdentifier,
} from "../lib/types/general";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { proximityComputationController } from "@/app/lib/proximityComputation.controller";
import { AppContext } from "../appContextProvider";
import { PathfindingResult } from "../lib/types/pathfinding";
import { ColorHelper } from "../lib/drawing/color.helper";
import { NumbersHelper } from "../lib/utils/numbers.helper";

const updateValue = (
  event: React.ChangeEvent<HTMLInputElement>,
  value: keyof ICountryValues,
) => {
  gameStateController.changeCountryValues({
    [value]: Number(event.target.value),
  });
};

const getCountryStats = (
  ownedLocations: IGameState["ownedLocations"],
  locationsData: IGameData["locationDataMap"], // TODO: use temp location data for population once it is implemented
  proximityResults: PathfindingResult,
): React.JSX.Element => {
  const proximityByLocations: Record<ILocationIdentifier, number> = {};
  const populationByLocation: Record<ILocationIdentifier, number> = {};
  const populationScaledByProximityPerLocation: Record<
    ILocationIdentifier,
    number
  > = {};

  /*   console.log("get country stats:", {
    ownedLocations,
    proximityResults,
    locationsData,
  }); */
  for (const loc of Object.keys(ownedLocations)) {
    proximityByLocations[loc] =
      ProximityComputationHelper.evaluationToProximity(
        proximityResults[loc]?.cost ?? 100,
      );
    populationByLocation[loc] = locationsData[loc].population ?? 0;

    populationScaledByProximityPerLocation[loc] =
      (proximityByLocations[loc] * populationByLocation[loc]) / 100;
  }
  /*   console.log("proximityByLocations", proximityByLocations);
  console.log("populationByLocation", populationByLocation);
  console.log(
    "populationScaledByProximityPerLocation",
    populationScaledByProximityPerLocation,
  ); */
  const meanProximity = Math.max(
    0,
    Object.values(proximityByLocations).reduce((a, b) => a + b, 0) /
      Object.values(proximityByLocations).length,
  );
  const totalPopulation = Object.values(populationByLocation).reduce(
    (a, b) => a + b,
    0,
  );
  const totalPopulationScaledByProximity = Math.round(
    Math.max(
      0,
      Object.values(populationScaledByProximityPerLocation).reduce(
        (a, b) => a + b,
        0,
      ),
    ),
  );

  return (
    <div className="grid grid-cols-4 gap-x-3">
      <div className="col-span-2 text-right">Mean Proximity:</div>
      <span
        className="col-span-1"
        style={{
          color: ColorHelper.rgbToHex(
            ...ColorHelper.getProximityColor(meanProximity),
          ),
        }}
      >
        {meanProximity.toFixed(2)}
      </span>
      <div className="col-span-2 text-right">Total Population:</div>
      <span className="col-span-1">
        {NumbersHelper.addDecimalThousandSeparators(totalPopulation)}
      </span>
      <div className="col-span-2 text-right">
        Population scaled by proximity:
      </div>
      <span className="col-span-1">
        {NumbersHelper.addDecimalThousandSeparators(
          totalPopulationScaledByProximity,
        )}
      </span>
    </div>
  );
};

export function CountryOverview() {
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

  if (!gameData) {
    return <div></div>;
  }

  return (
    <div>
      <p className="font-bold">{gameState.countryCode}</p>
      <div className="grid grid-cols-3 gap-2">
        <span className="text-right">Land</span>
        <input
          type="range"
          min={-100}
          max={100}
          value={gameState.country.landVsNaval}
          onChange={(e) => updateValue(e, "landVsNaval")}
        />
        <span className="text-left">Naval</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <span className="text-right">Centralization</span>
        <input
          type="range"
          min={-100}
          max={100}
          value={gameState.country.centralizationVsDecentralization}
          onChange={(e) => updateValue(e, "centralizationVsDecentralization")}
        />
        <span className="text-left">Decentralization</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <span className="text-right">Administrative Ability</span>
        <input
          id="rulerAdministrativeAbility"
          className="col-span-1"
          type="range"
          min={0}
          max={100}
          value={gameState.country.rulerAdministrativeAbility}
          onChange={(e) => updateValue(e, "rulerAdministrativeAbility")}
        />
        <output name="result" htmlFor="rulerAdministrativeAbility"></output>
      </div>

      {Object.keys(gameState.ownedLocations).length > 0 && (
        <>
          <hr className="my-1"></hr>
          {getCountryStats(
            gameState.ownedLocations,
            gameData.locationDataMap,
            proximityComputation.result,
          )}
        </>
      )}
    </div>
  );
}
