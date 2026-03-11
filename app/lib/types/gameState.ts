import { ZodConstructibleLocation } from "@/app/lib/types/constructibleLocation";
import { ZodCountryInstance } from "@/app/lib/types/countryInstance";
import { ZodRoadKey, ZodRoadType } from "@/app/lib/types/roads";
import { ZodTemporaryLocationData } from "@/app/lib/types/temporaryLocationData";
import { z } from "zod";

export const ZodGameStateTemporaryLocationRecord = z.record(
  z.string(),
  ZodTemporaryLocationData,
);

export const ZodGameStateOwnedLocationRecord = z.record(
  z.string(),
  ZodConstructibleLocation,
);

export const ZodGameState = z.object({
  version: z.string(),
  countryCode: z.string().nullable(),
  country: ZodCountryInstance.nullable(),
  roads: z.record(ZodRoadKey, ZodRoadType.nullable()),
  ownedLocations: ZodGameStateOwnedLocationRecord,
  capitalLocation: z.string().optional(),
  temporaryLocationData: ZodGameStateTemporaryLocationRecord,
});

export type GameStateOwnedLocationRecord = z.infer<
  typeof ZodGameStateOwnedLocationRecord
>;
export type GameStateTemporaryLocationRecord = z.infer<
  typeof ZodGameStateTemporaryLocationRecord
>;

export type GameState = z.infer<typeof ZodGameState>;
