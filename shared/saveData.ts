import { z } from "zod";

export const SaveParsingTaskName = z.enum([
  "locationsIndexList",
  "version",
  "countryCode",
  "countryTags",
  "countryCodeIndex",
  "countryData",
  "ownedLocations",
  "buildingsRaw",
  "buildings",
]);

export type SaveParsingTaskName = z.infer<typeof SaveParsingTaskName>;

export const SaveParsingTaskLabel: Record<SaveParsingTaskName, string> = {
  locationsIndexList: "Location list",
  version: "Game version",
  countryCode: "Country",
  countryTags: "Country tags",
  countryCodeIndex: "Country index",
  countryData: "Country data",
  ownedLocations: "Owned locations",
  buildingsRaw: "Buildings (raw)",
  buildings: "Buildings",
};

export const ZodSaveParsingTaskResult = z.object({
  success: z.boolean(),
  skipped: z.boolean().optional(),
  error: z.string().optional(),
});

export type SaveParsingTaskResult = z.infer<typeof ZodSaveParsingTaskResult>;

export const ZodSaveData = z.object({
  data: z.object({
    version: z.string().nullable(),
    countryCode: z.string().nullable(),
    ownedLocations: z.array(z.string()),
    locationBuildings: z.record(
      z.string(),
      z.object({
        name: z.string(),
        level: z.number(),
      }),
    ),
  }),
  tasks: z.record(SaveParsingTaskName, ZodSaveParsingTaskResult),
});

export type SaveData = z.infer<typeof ZodSaveData>;
