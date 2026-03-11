import { z } from "zod";

import { ZodRoadType } from "@/app/lib/types/roads";
import { ZodTopography } from "@/app/lib/types/topography";
import { ZodVegetation } from "@/app/lib/types/vegetation";
import { ZodCountryProximityBuffs } from "@/app/lib/types/countryProximityBuffs";
import { ZodBuffValue } from "@/app/lib/types/buffValue";

export const ZodProximityComputationRule = z.object({
  proximityPercentageModifierType: z.enum([
    "proximityCostReduction",
    "proximitySpeedIncrease",
  ]),
  throughSeaEdgeCountedAsLandProximity: z.boolean(),
  baseCost: z.number(),
  baseRiverCost: z.number(),
  baseCostWithMaritimePresence: z.number(),
  baseCostWithoutMaritimePresence: z.number(),
  topography: z.partialRecord(ZodTopography, ZodBuffValue),
  vegetation: z.partialRecord(ZodVegetation, ZodBuffValue),
  developmentImpact: ZodBuffValue,
  harborSuitabilityImpact: ZodBuffValue,
  harborSuitabilityIsMultiplicative: z.boolean(),
  valuesImpact: z.object({
    landVsNaval: z.tuple([ZodCountryProximityBuffs, ZodCountryProximityBuffs]),
    centralizationVsDecentralization: z.tuple([
      ZodCountryProximityBuffs,
      ZodCountryProximityBuffs,
    ]),
  }),
  rulerAdministrativeAbilityImpact: ZodBuffValue,
  roadProximityCostReduction: z.partialRecord(ZodRoadType, ZodBuffValue),
});

export type ProximityComputationRule = z.infer<
  typeof ZodProximityComputationRule
>;
