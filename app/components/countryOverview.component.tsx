import React, {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { gameStateController } from "@/app/lib/gameState.controller";
import {
  ICountryInstance,
  IGameData,
  IGameState,
  ILocationIdentifier,
} from "../lib/types/general";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { proximityComputationController } from "@/app/lib/proximityComputation.controller";
import { AppContext } from "../appContextProvider";
import { PathfindingResult } from "../lib/types/pathfinding";
import { NumbersHelper } from "../lib/utils/numbers.helper";
import { ExpandablePanel } from "@/app/components/expandablePanel.component";
import { FoldableMenu } from "@/app/components/foldableMenu.component";
import { FormatedProximity } from "./formatedProximity.component";

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

  for (const loc of Object.keys(ownedLocations)) {
    proximityByLocations[loc] =
      ProximityComputationHelper.evaluationToProximity(
        proximityResults[loc]?.cost ?? 100,
      );
    populationByLocation[loc] = locationsData[loc].population ?? 0;

    populationScaledByProximityPerLocation[loc] =
      (proximityByLocations[loc] * populationByLocation[loc]) / 100;
  }
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
      <FormatedProximity
        className="col-span-1"
        proximity={meanProximity}
      ></FormatedProximity>
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

function CountryValueSlider({
  expanded,
  value,
  rangeMin,
  rangeMax,
  minValueLabel,
  maxValueLabel,
  onChange,
}: {
  expanded: boolean;
  value: number;
  rangeMin: number;
  rangeMax: number;
  minValueLabel: string;
  maxValueLabel: string;
  onChange: (value: number) => void;
}) {
  const collapsedLabel = value > 0 ? maxValueLabel : minValueLabel;
  return expanded ? (
    <div className="grid grid-cols-3 gap-2">
      <span className={"text-right "}>{minValueLabel}</span>
      <input
        type="range"
        min={rangeMin}
        max={rangeMax}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-left">{maxValueLabel}</span>
    </div>
  ) : (
    <p>
      <span className="text-sm font-bold">{collapsedLabel}</span>: {value}
    </p>
  );
}

function CountryValueInput({
  valueKey,
  value,
}: {
  valueKey: keyof ICountryInstance["values"];
  value: number;
}) {
  const [labelMin, labelMax] = valueKey.toLowerCase().split("vs");
  const labelMinFormatted = useMemo(() => {
    return labelMin.charAt(0).toUpperCase() + labelMin.slice(1);
  }, [valueKey]);
  const labelMaxFormatted = useMemo(() => {
    return labelMax.charAt(0).toUpperCase() + labelMax.slice(1);
  }, [valueKey]);
  const currentValueSide = useMemo(() => (value > 0 ? "max" : "min"), [value]);
  const displayedValue = useMemo(() => Math.abs(value), [value]);
  const [inputValue, setInputValue] = useState<string>(
    displayedValue.toString(),
  );

  useEffect(() => {
    setInputValue(displayedValue.toString());
  }, [displayedValue]);

  const changeValue = useCallback(
    (changeEvent: ChangeEvent<HTMLInputElement>) => {
      const raw = changeEvent.target.value;
      setInputValue(raw);

      const newValue = Number(raw);
      if (Number.isNaN(newValue)) {
        return;
      }

      gameStateController.changeCountryValues({
        [valueKey]: currentValueSide === "min" ? -newValue : newValue,
      });
    },
    [currentValueSide, valueKey],
  );
  const changeValueSide = useCallback(() => {
    gameStateController.changeCountryValues({
      [valueKey]: -value,
    });
  }, [value, valueKey]);
  return (
    <div className="flex flex-row gap-2 items-center">
      <select
        value={currentValueSide}
        onChange={changeValueSide}
        className="w-full"
      >
        <option value="min">{labelMinFormatted}</option>
        <option value="max">{labelMaxFormatted}</option>
      </select>
      <input
        type="number"
        className="ml-auto flex-none"
        min={0}
        max={100}
        value={inputValue}
        onChange={changeValue}
      ></input>
    </div>
  );
}

function RulerAdministrativeSkillInput({ value }: { value: number }) {
  const [inputValue, setInputValue] = useState<string>(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const changeValue = useCallback(
    (changeEvent: ChangeEvent<HTMLInputElement>) => {
      const raw = changeEvent.target.value;
      setInputValue(raw);

      const newValue = Number(raw);
      if (Number.isNaN(newValue)) {
        return;
      }

      gameStateController.changeCountryRulerAdministrativeAbility(newValue);
    },
    [],
  );

  return (
    <div className="flex flex-row gap-2 items-center px-1">
      <span className="w-full">Administrative skill</span>
      <input
        type="number"
        className="ml-auto flex-none"
        min={0}
        max={100}
        value={inputValue}
        onChange={changeValue}
      ></input>
    </div>
  );
}

export function CountryOverview() {
  const [countryMenuExpanded, setCountryMenuExpanded] = useState(false);
  const [countryStatsExpanded, setCountryStatsExpanded] = useState(false);
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

  const country = gameState.country;
  if (!country) {
    return <div>Loading...</div>;
  }
  return (
    <ExpandablePanel>
      {(isExpanded) => (
        <>
          <FoldableMenu
            title="Country Values"
            isExpanded={countryMenuExpanded}
            onToggle={() => setCountryMenuExpanded(!countryMenuExpanded)}
          >
            <div className="flex flex-col gap-1">
              <CountryValueInput
                valueKey={"landVsNaval"}
                value={country.values.landVsNaval ?? 0}
              ></CountryValueInput>

              <CountryValueInput
                valueKey={"centralizationVsDecentralization"}
                value={country.values.centralizationVsDecentralization ?? 0}
              ></CountryValueInput>

              <RulerAdministrativeSkillInput
                value={country.rulerAdministrativeAbility}
              />
            </div>
          </FoldableMenu>

          <FoldableMenu
            title="Country Statistics"
            isExpanded={countryStatsExpanded}
            onToggle={() => setCountryStatsExpanded(!countryStatsExpanded)}
          >
            {(Object.keys(gameState?.ownedLocations ?? []).length > 0 && (
              <>
                {getCountryStats(
                  gameState.ownedLocations,
                  gameData.locationDataMap,
                  proximityComputation.result,
                )}
              </>
            )) || (
              <div className="text-stone-400 text-italic">
                No owned locations - either select a country above, or create
                your own country from scratch by selecting a location
              </div>
            )}
          </FoldableMenu>
        </>
      )}
    </ExpandablePanel>
  );
}
