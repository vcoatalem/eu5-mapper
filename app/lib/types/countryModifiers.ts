import { ZodCountryProximityBuffs } from "@/app/lib/types/countryProximityBuffs";
import { z } from "zod";

export const ZodCountryModifiersTemplate = z.object({
  name: z.string(),
  description: z.string().nullable(),
  buff: ZodCountryProximityBuffs,
});

export type CountryModifierTemplate = z.infer<
  typeof ZodCountryModifiersTemplate
>;
