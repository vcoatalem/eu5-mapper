import { z } from "zod";

import { RoadType } from "@/app/lib/types/roads";
import { Topography, Vegetation } from "@/app/lib/types/location";

export const ZodCountryProximityBuffs = z.object({
  genericModifier: z.number().nullable().optional().default(null),
  landModifier: z.number().nullable().optional().default(null),
  seaWithMaritimeFlatCostReduction: z
    .number()
    .nullable()
    .optional()
    .default(null),
  seaWithoutMaritimeFlatCostReduction: z
    .number()
    .nullable()
    .optional()
    .default(null),
  portFlatCostReduction: z.number().nullable().optional().default(null),
  mountainsMultiplier: z.number().nullable().optional().default(null),
  plateauMultiplier: z.number().nullable().optional().default(null),
  hillsMultiplier: z.number().nullable().optional().default(null),
});

export type ICountryProximityBuffs = z.infer<typeof ZodCountryProximityBuffs>;

export const baseCountryProximityBuffs: ICountryProximityBuffs = {
  genericModifier: null,
  landModifier: null,
  seaWithMaritimeFlatCostReduction: null,
  seaWithoutMaritimeFlatCostReduction: null,
  portFlatCostReduction: null,
  mountainsMultiplier: null,
  plateauMultiplier: null,
  hillsMultiplier: null,
};

export interface ICountryProximityBuffsMetadata {
  label: string;
  valueDefinition: IBuffValueDescriptor;
}

type IBuffValueDescriptor = {
  type: "flat" | "percentage";
  description: string;
};
type IBuffPercentageValue = { type: "percentage"; value: number };
type IBuffFlatValue = { type: "flat"; value: number };

export type IBuffValue = IBuffPercentageValue | IBuffFlatValue;

export interface IProximityComputationRule {
  proximityPercentageModifierType:
    | "proximityCostReduction"
    | "proximitySpeedIncrease";
  // this is the value that additive percentage modifiers are summing up to.
  // proximityCostReduction is the additive modifier that was used in 1.0.11
  // proximitySpeedIncrease is the multiplicative modifier that is used since 1.1.0
  throughSeaEdgeCountedAsLandProximity: boolean;
  baseCost: number;
  baseRiverCost: number;
  baseCostWithMaritimePresence: number;
  baseCostWithoutMaritimePresence: number;
  topography: Record<Topography, IBuffValue>;
  vegetation: Record<Exclude<Vegetation, null>, IBuffValue>;
  developmentImpact: IBuffValue;
  harborSuitabilityImpact: IBuffPercentageValue;
  harborSuitabilityIsMultiplicative: boolean;
  valuesImpact: {
    landVsNaval: [ICountryProximityBuffs, ICountryProximityBuffs];
    centralizationVsDecentralization: [
      ICountryProximityBuffs,
      ICountryProximityBuffs,
    ];
  };
  rulerAdministrativeAbilityImpact: IBuffValue;
  roadProximityCostReduction: Record<RoadType, IBuffValue>;
}
