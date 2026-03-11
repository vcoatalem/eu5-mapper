import { z } from "zod";

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

export type CountryProximityBuffs = z.infer<typeof ZodCountryProximityBuffs>;

export const baseCountryProximityBuffs: CountryProximityBuffs = {
  genericModifier: null,
  landModifier: null,
  seaWithMaritimeFlatCostReduction: null,
  seaWithoutMaritimeFlatCostReduction: null,
  portFlatCostReduction: null,
  mountainsMultiplier: null,
  plateauMultiplier: null,
  hillsMultiplier: null,
};
