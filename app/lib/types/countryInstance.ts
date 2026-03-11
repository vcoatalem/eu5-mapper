import { ZodCountryData } from "@/app/lib/types/country";
import { ZodCountryProximityBuffs } from "@/app/lib/types/countryProximityBuffs";
import { ZodCountryValues } from "@/app/lib/types/countryValues";

import { z } from "zod";

export const ZodCountryInstance = z.object({
  templateData: ZodCountryData.nullable(),
  values: ZodCountryValues,
  rulerAdministrativeAbility: z.number(),
  modifiers: z.record(
    z.string(),
    z.object({
      buff: ZodCountryProximityBuffs,
      description: z.string(),
      enabled: z.boolean(),
    }),
  ),
});

export type CountryInstance = z.infer<typeof ZodCountryInstance>;
