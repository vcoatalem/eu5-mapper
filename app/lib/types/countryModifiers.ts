import { ZodCountryProximityBuffs } from "@/app/lib/types/countryProximityBuffs";
import { z } from "zod";

const ZodCountryModifiersTemplate = z.object({
  name: z.string(),
  description: z.string().nullable(),
  buff: ZodCountryProximityBuffs,
});

export type ICountryModifierTemplate = z.infer<
  typeof ZodCountryModifiersTemplate
>;
