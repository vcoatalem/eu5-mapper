import { countryBuffsMetadata } from "@/app/lib/classes/countryProximityBuffs.const";
import { GameData } from "../types/general";
import { ArrayHelper } from "@/app/lib/array.helper";
import { ObjectHelper } from "@/app/lib/object.helper";
import {
  baseCountryProximityBuffs,
  CountryProximityBuffs,
} from "@/app/lib/types/countryProximityBuffs";
import { BuffValue } from "@/app/lib/types/buffValue";
import { CountryValues } from "@/app/lib/types/countryValues";
import { CountryInstance } from "@/app/lib/types/countryInstance";

export class ProximityBuffsRecord {
  private countryProximityBuffs: Record<string, CountryProximityBuffs> = {};
  constructor(
    private readonly rule: GameData["proximityComputationRule"],
    private readonly country: CountryInstance | null,
  ) {
    if (!country) {
      return;
    }

    const navalVsLand = this.computeCountryValuesBuff("landVsNaval");
    const centralizationVsDecentralization = this.computeCountryValuesBuff(
      "centralizationVsDecentralization",
    );

    const rulerAdministrativeAbility = {
      ...baseCountryProximityBuffs,
      genericModifier:
        (country?.rulerAdministrativeAbility ?? 0) *
        rule.rulerAdministrativeAbilityImpact.value,
    };

    const modifiersBuff = ArrayHelper.reduceToRecord(
      ObjectHelper.getTypedEntries(this.country?.modifiers ?? {}),
      ([buffName]) => buffName,
      ([, { buff, enabled }]) => {
        if (!enabled) return undefined;
        return buff;
      },
    );

    this.countryProximityBuffs = {
      navalVsLand,
      centralizationVsDecentralization,
      rulerAdministrativeAbility,
      ...modifiersBuff,
    };
  }

  private computeCountryValuesBuff(
    valueKey: keyof CountryValues,
  ): CountryProximityBuffs {
    const value = this.country?.values[valueKey];
    if (value === undefined) {
      throw new Error('unrecognised country value key: "' + valueKey + '"');
    }

    const buffToApply: CountryProximityBuffs =
      value > 0
        ? this.rule.valuesImpact[valueKey][1]
        : this.rule.valuesImpact[valueKey][0];

    if (!buffToApply || typeof buffToApply !== "object") {
      throw new Error(
        "[ProximityBuffsRecord] Invalid buff definition for " +
          valueKey +
          ": " +
          JSON.stringify(buffToApply),
      );
      return {} as CountryProximityBuffs;
    }
    const impactFactor = Math.abs(value) / 100;
    let res = { ...baseCountryProximityBuffs };

    for (const key of Object.keys(buffToApply) as Array<
      keyof CountryProximityBuffs
    >) {
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

  public getBuffsOfType(
    type: keyof CountryProximityBuffs,
  ): Record<string, BuffValue> {
    const result: Record<string, BuffValue> = {};
    for (const [sourceName, buffEffects] of Object.entries(
      this.countryProximityBuffs,
    )) {
      const buffValue = buffEffects[type];
      if (buffValue) {
        result[sourceName] = {
          type: countryBuffsMetadata[type].valueDefinition.type,
          value: buffValue,
        };
      }
    }
    return result;
  }

  public getBuffsToDisplay(): Set<keyof CountryProximityBuffs> {
    return Object.entries(this.countryProximityBuffs).reduce(
      (acc, [, buffEffects]) => {
        const newSet = new Set(acc);
        for (const buffKey of ObjectHelper.getTypedEntries(buffEffects)
          .filter(([, value]) => !!value)
          .map(([key]) => key)) {
          newSet.add(buffKey);
        }
        return newSet;
      },
      new Set<keyof CountryProximityBuffs>(),
    );
  }
}
