import { countryBuffsMetadata } from "@/app/lib/classes/countryProximityBuffs.const";
import {
  ICountryValues,
  IGameData,
  IGameState,
} from "../types/general";
import {
  IBuffValue,
  ICountryProximityBuffs,
} from "../types/proximityComputationRules";

export class ProximityBuffsRecord {
  private countryProximityBuffs: Record<string, ICountryProximityBuffs> = {};
  constructor(
    private readonly rule: IGameData["proximityComputationRule"],
    private readonly country: IGameState["country"],
  ) {
    const navalVsLand = this.computeCountryValuesBuff("landVsNaval");
    const centralizationVsDecentralization = this.computeCountryValuesBuff(
      "centralizationVsDecentralization",
    );

    const rulerAdministrativeAbility = {
      genericModifier:
        (country?.rulerAdministrativeAbility ?? 0) *
        rule.rulerAdministrativeAbilityImpact.value,
    };

    const modifiersBuff = Object.entries(this.country?.modifiers ?? {}).reduce(
      (acc, [name, { buff, enabled }]) => {
        if (enabled) acc[name] = buff;
        return acc;
      },
      {} as Record<string, ICountryProximityBuffs>,
    );

    this.countryProximityBuffs = {
      navalVsLand,
      centralizationVsDecentralization,
      rulerAdministrativeAbility,
      ...modifiersBuff,
    };
  }

  private computeCountryValuesBuff(
    valueKey: keyof ICountryValues,
  ): Partial<ICountryProximityBuffs> {
    const value = this.country?.values[valueKey];
    if (typeof value !== "number" || value === 0) {
      return {};
    }

    const buffToApply: ICountryProximityBuffs =
      value > 0
        ? this.rule.valuesImpact[valueKey][1]
        : this.rule.valuesImpact[valueKey][0];

    if (!buffToApply || typeof buffToApply !== "object") {
      console.error(
        "[ProximityBuffsRecord] Invalid buff definition for",
        valueKey,
        buffToApply,
      );
      return {};
    }
    const impactFactor = Math.abs(value) / 100;
    const res: Partial<ICountryProximityBuffs> = {};

    for (const key of Object.keys(buffToApply) as Array<keyof ICountryProximityBuffs>) {
      if (!(key in countryBuffsMetadata)) {
        console.error(
          "[ProximityBuffsRecord] Unknown buff key for",
          valueKey,
          "key:",
          key,
          "buff:",
          buffToApply,
        );
        continue;
      }

      const buffToApplyValue = buffToApply[key];
      if (buffToApplyValue) {
          res[key] = buffToApplyValue * impactFactor;
      }
    }
    return res;
  }

  public getBuffsOfType(type: keyof ICountryProximityBuffs): Record<string, IBuffValue> {
    const result: Record<string, IBuffValue> = {};
    for (const [sourceName, buffEffects] of Object.entries(
      this.countryProximityBuffs,
    )) {
      const buffValue = buffEffects[type];
      if (buffValue) {
        result[sourceName] = { type: countryBuffsMetadata[type].valueDefinition.type, value: buffValue }
      }
    }
    return result;
  }

  public getBuffsToDisplay(): Set<keyof ICountryProximityBuffs> {
    return Object.entries(this.countryProximityBuffs).reduce((acc, [,buffEffects]) => {
      const newSet = new Set(acc);
      for (const buffKey of Object.keys(buffEffects) as Array<keyof ICountryProximityBuffs>) {
        newSet.add(buffKey);
      }
      return newSet;
    }, new Set<keyof ICountryProximityBuffs>())
  }
}
