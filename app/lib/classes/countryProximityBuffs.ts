import { countryBuffsMetadata } from "@/app/lib/classes/countryProximityBuffs.const";
import { IGameData } from "../types/general";
import { ArrayHelper } from "@/app/lib/array.helper";
import { ObjectHelper } from "@/app/lib/object.helper";
import {
  baseCountryProximityBuffs,
  ICountryProximityBuffs,
} from "@/app/lib/types/countryProximityBuffs";
import { IBuffValue } from "@/app/lib/types/buffValue";
import { ICountryValues } from "@/app/lib/types/countryValues";
import { ICountryInstance } from "@/app/lib/types/countryInstance";

export class ProximityBuffsRecord {
  private countryProximityBuffs: Record<string, ICountryProximityBuffs> = {};
  constructor(
    private readonly rule: IGameData["proximityComputationRule"],
    private readonly country: ICountryInstance | null,
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
    valueKey: keyof ICountryValues,
  ): ICountryProximityBuffs {
    const value = this.country?.values[valueKey];
    if (value === undefined) {
      throw new Error('unrecognised country value key: "' + valueKey + '"');
    }

    const buffToApply: ICountryProximityBuffs =
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
      return {} as ICountryProximityBuffs;
    }
    const impactFactor = Math.abs(value) / 100;
    let res = { ...baseCountryProximityBuffs };

    for (const key of Object.keys(buffToApply) as Array<
      keyof ICountryProximityBuffs
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
    type: keyof ICountryProximityBuffs,
  ): Record<string, IBuffValue> {
    const result: Record<string, IBuffValue> = {};
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

  public getBuffsToDisplay(): Set<keyof ICountryProximityBuffs> {
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
      new Set<keyof ICountryProximityBuffs>(),
    );
  }
}
