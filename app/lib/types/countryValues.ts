import { z } from "zod";

export const ZodCountryValues = z.object({
  centralizationVsDecentralization: z.number(),
  landVsNaval: z.number(),
});

export type ICountryValues = z.infer<typeof ZodCountryValues>;
