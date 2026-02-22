import { countryProximityBuffsDisplayableData } from "@/app/lib/classes/countryProximityBuffs.const";
import {
  ICountryValues,
  IGameData,
  IGameState,
  ILocationGameData,
  Topography,
} from "../types/general";
import { IProximityBuffDisplayableData, IProximityBuffs } from "../types/proximityComputationRules";

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

    type NumericBuffKey = Exclude<
      keyof IProximityBuffs,
      "topographyMultipliers"
    >;

    const allowedKeys: Array<keyof IProximityBuffs> = [
      "genericModifier",
      "landModifier",
      "seaWithMaritimeFlatCostReduction",
      "seaWithoutMaritimeFlatCostReduction",
      "portFlatCostReduction",
      "topographyMultipliers",
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

      if (key === "topographyMultipliers") {
        const source = buffToApply.topographyMultipliers;
        if (!source) {
          continue;
        }

        const topographyBuffs: Partial<Record<Topography, number>> = {};
        for (const topographyKey of Object.keys(source) as Topography[]) {
          const topographyValue = source[topographyKey];
          if (typeof topographyValue === "number") {
            topographyBuffs[topographyKey] = topographyValue * impactFactor;
          }
        }

        if (Object.keys(topographyBuffs).length > 0) {
          res.topographyMultipliers = topographyBuffs;
        }
      } else {
        const numericKey = key as NumericBuffKey;
        const buffToApplyValue = buffToApply[numericKey];
        if (typeof buffToApplyValue === "number") {
          res[numericKey] = buffToApplyValue * impactFactor;
        }
      }
    }

    return res;
  }

  public getBuffsOfType(
    type: keyof IProximityBuffs,
    topography?: ILocationGameData["topography"],
  ): {
    buffRecord: Record<string, number>;
    sum: number;
  } {
    const buffRecord: Record<string, number> = Object.fromEntries(
      Object.entries(this.countryProximityBuffs).map(
        ([buffName, buffEffects]) => {
          const buffEffect = buffEffects[type];
          switch (typeof buffEffect) {
            case "number":
              return [buffName, buffEffect];
            case "object":
              const topographyBuff = buffEffect[topography ?? "unknown"] ?? 0;
              return [buffName, topographyBuff];
            default:
              return [buffName, 0];
          }
        },
      ),
    );
    return {
      buffRecord,
      sum: Object.values(buffRecord).reduce((a, b) => a + b, 0),
    };
  }

  public getBuffsToDisplay(): Partial<Record<keyof IProximityBuffs, IProximityBuffDisplayableData>> {
    const buffs = Object.entries(this.countryProximityBuffs).reduce((acc, [,buffEffects]) => {
      const newSet = new Set(acc);
      for (const buffKey of Object.keys(buffEffects) as Array<keyof IProximityBuffs>) {
        newSet.add(buffKey);
      }
      return newSet;
    }, new Set<keyof IProximityBuffs>())
    const res: Partial<Record<keyof IProximityBuffs, IProximityBuffDisplayableData>> = {};
    for (const buffKey of buffs) {
      res[buffKey] = countryProximityBuffsDisplayableData[buffKey];
    }
    return res;
  }
}
