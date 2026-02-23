import {
  ICountryValues,
  IGameData,
  IGameState,
} from "../types/general";
import { IProximityBuffs } from "../types/proximityComputationRules";

export class ProximityBuffsRecord {
  private countryProximityBuffs: Record<string, IProximityBuffs> = {};
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
        rule.rulerAdministrativeAbilityImpact,
    };


    const modifiersBuff = Object.entries(this.country?.modifiers ?? {}).reduce((acc, [name, {buff, enabled}]) => {
      if (enabled) {
        acc[name] = buff;
      }
      return acc;
    }, {} as Record<string, IProximityBuffs>);


    this.countryProximityBuffs = {
      navalVsLand,
      centralizationVsDecentralization,
      rulerAdministrativeAbility,
      ...modifiersBuff,
    };
  }


  private computeCountryValuesBuff(
    valueKey: keyof ICountryValues,
  ): Partial<IProximityBuffs> {
    const value = this.country?.values[valueKey];
    if (typeof value !== "number" || value === 0) {
      return {};
    }

    const buffToApply =
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
    const res: Partial<IProximityBuffs> = {};

    const allowedKeys: Array<keyof IProximityBuffs> = [
      "genericModifier",
      "landModifier",
      "seaWithMaritimeFlatCostReduction",
      "seaWithoutMaritimeFlatCostReduction",
      "portFlatCostReduction",
      "mountainsMultiplier",
      "hillsMultiplier",
      "plateauMultiplier"
    ];

    for (const key of Object.keys(buffToApply) as Array<
      keyof IProximityBuffs
    >) {
      if (!allowedKeys.includes(key)) {
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
      if (typeof buffToApplyValue === "number") {
        res[key] = buffToApplyValue * impactFactor;
      }
    }

    return res;
  }

  public getBuffsOfType(type: keyof IProximityBuffs): {
    buffRecord: Record<string, number>;
    sum: number;
  } {
    const buffRecord: Record<string, number> = Object.fromEntries(
      Object.entries(this.countryProximityBuffs).map(
        ([buffName, buffEffects]) => {
          const buffEffect = buffEffects[type];
          const value = typeof buffEffect === "number" ? buffEffect : 0;
          return [buffName, value];
        },
      ),
    );
    return {
      buffRecord,
      sum: Object.values(buffRecord).reduce((a, b) => a + b, 0),
    };
  }

  public getBuffsToDisplay(): Set<keyof IProximityBuffs> {
    return Object.entries(this.countryProximityBuffs).reduce((acc, [,buffEffects]) => {
      const newSet = new Set(acc);
      for (const buffKey of Object.keys(buffEffects) as Array<keyof IProximityBuffs>) {
        newSet.add(buffKey);
      }
      return newSet;
    }, new Set<keyof IProximityBuffs>())
  }
}
