import { ZodLocationHierarchy } from "@/app/lib/types/locationHierarchy";
import { ZodLocationRank } from "@/app/lib/types/locationRank";
import { ZodTopography } from "@/app/lib/types/topography";
import { ZodVegetation } from "@/app/lib/types/vegetation";
import * as z from "zod";

export const ZodLocationGameData = z.object({
  name: z.string(),
  hexColor: z.string(),
  centerCoordinates: z.object({
    x: z.number(),
    y: z.number(),
  }),
  secondaryCoordinates: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
      }),
    )
    .optional(),
  topography: ZodTopography,
  vegetation: ZodVegetation.nullable().optional().default(null),
  hierarchy: ZodLocationHierarchy,
  naturalHarborSuitability: z.number().optional().default(0), // only specified if isCoastal
  ownable: z.boolean().optional(),
  isSea: z.boolean().default(false).optional(),
  isLake: z.boolean().optional().default(false),
  isCoastal: z.boolean().optional().default(false),
  isOnRiver: z.boolean().optional().default(false),
  isOnLake: z.boolean().optional().default(false),
  rank: z.nullable(ZodLocationRank).optional().default(null),
  buildings: z.array(z.string()),
  development: z.number().optional().default(0),
  population: z.number().optional().default(0),
});

export const ZodLocationGameDataArray = z.array(ZodLocationGameData);

export type ILocationGameData = z.infer<typeof ZodLocationGameData>;
