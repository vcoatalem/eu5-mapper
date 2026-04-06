import { z } from "zod";
import type { SaveParsingTaskName } from "@shared/saveData";

export const ZodSavegameFlagString = z
  .string()
  .regex(/^[A-Z]+=[\s\S]+$/)
  .transform((str) => str.split("=")[0]);

export const ZodSavegameCountryTagRecord = z
  .record(z.number(), z.string())
  .transform((record) =>
    Object.entries(record).map(([index, countryCode]) => ({
      index: parseInt(index),
      countryCode,
    })),
  );

export const ZodLocationIndexList = z.array(z.number());
export const ZodLocationIdentifierList = z.array(z.string());

export const ZodBuilding = z.object({
  type: z.string(),
  level: z.number().positive().default(1),
  location: z.number().positive(),
});

export const TaskSchemas = {
  locationsIndexList: ZodLocationIdentifierList,
  version: z.string(),
  countryCode: ZodSavegameFlagString,
  countryTags: ZodSavegameCountryTagRecord,
  countryCodeIndex: z.number().nullable(),
  countryData: z.object({ countryOwnedLocations: z.any() }),
  ownedLocations: ZodLocationIndexList,
  buildingsRaw: z.record(z.string(), ZodBuilding).transform((obj) => Object.values(obj)).nullable(),
  buildings: z.array(ZodBuilding),
} as const satisfies Record<SaveParsingTaskName, z.ZodTypeAny>;
