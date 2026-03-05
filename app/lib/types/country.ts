import { z } from "zod";

export const ZodCountryData = z.object({
  code: z.string(),
  capital: z.string(),
  locations: z.array(z.string()),
  centralizationVsDecentralization: z.number(), // from -100 (fully centralized) to 100 (fully decentralized)
  landVsNaval: z.number(), // from -100 (fully land) to 100 (fully naval)
  name: z.string(),
  flagUrl: z.string().nullable(),
});

export const ZodCountryDataArray = z.array(ZodCountryData);

export type ICountryData = z.infer<typeof ZodCountryData>;
