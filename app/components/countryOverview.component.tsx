import { FoldableMenu } from "@/app/components/foldableMenu.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AppContext } from "../appContextProvider";
import { ICountryInstance } from "../lib/types/general";
import { CountryStats } from "./countryStatsComponent";

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

  const { gameData } = useContext(AppContext);

  if (!gameData) {
    return <div></div>;
  }

  const country = gameState.country;
  if (!country) {
    return <div>Loading...</div>;
  }
  return (
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
          <CountryStats
            align={true}
            ownedLocations={gameState.ownedLocations}
          ></CountryStats>
        )) || (
            <div className="text-stone-400 text-italic">
              No owned locations - either select a country above, or create your
              own country from scratch by selecting a location
            </div>
          )}
      </FoldableMenu>
    </>
  );
}
