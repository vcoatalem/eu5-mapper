import { z } from "zod";

import { ICountryProximityBuffs } from "@/app/lib/types/proximityComputationRules";

const ZodCountryData = z.object({
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

export interface ICountryInstance {
  templateData: ICountryData | null;
  values: ICountryValues;
  rulerAdministrativeAbility: number; // from 0 to 100, higher means more impact of proximity on the country
  modifiers: Record<
    string,
    { buff: ICountryProximityBuffs; description: string; enabled: boolean }
  >;
}

export interface ICountryValues {
  centralizationVsDecentralization: number;
  landVsNaval: number;
}
