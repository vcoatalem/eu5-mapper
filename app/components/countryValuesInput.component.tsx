import { gameStateController } from "@/app/lib/gameState.controller";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ICountryInstance } from "../lib/types/general";
import formStyles from "@/app/components/countryBuffs/forms.module.css";

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
    <div className="flex flex-row gap-2 items-center border-b border-stone-600 pb-2">
      <select
        value={currentValueSide}
        onChange={changeValueSide}
        className={[formStyles.formLabel, formStyles.formLabelSmall, "cursor-pointer"].join(" ")}
        style={{ border: "none" }}
      >
        <option value="min">{labelMinFormatted}</option>
        <option value="max">{labelMaxFormatted}</option>
      </select>
      <input
        type="number"
        className={formStyles.formValue}
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
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-row gap-2 items-center">
      <button onClick={() => inputRef.current?.focus()} className={[formStyles.formLabel, formStyles.formLabelSmall, "cursor-pointer"].join(" ")}>
        <span className="pl-1">Administrative skill</span></button>
      <input
        ref={inputRef}
        type="number"
        className={[formStyles.formValue].join(" ")}
        min={0}
        max={100}
        value={inputValue}
        onChange={changeValue}
      ></input>
    </div>
  );
}

export function CountryValuesInput({ country, className }: { country: ICountryInstance, className?: string }) {
  return (
    <div className={["flex flex-col gap-1 mb-1", className].filter(Boolean).join(" ")}>
      <CountryValueInput
        valueKey={"landVsNaval"}
        value={country.values.landVsNaval ?? 0}
      />

      <CountryValueInput
        valueKey={"centralizationVsDecentralization"}
        value={country.values.centralizationVsDecentralization ?? 0}
      />

      <RulerAdministrativeSkillInput
        value={country.rulerAdministrativeAbility}
      />
    </div>
  );
}
