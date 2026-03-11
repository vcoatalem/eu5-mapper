import { z } from "zod";

export const ZodCountryValues = z.object({
  centralizationVsDecentralization: z.number(),
  landVsNaval: z.number(),
});

export type CountryValues = z.infer<typeof ZodCountryValues>;
