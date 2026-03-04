import * as z from "zod";

const ZodTopography = z.enum([
  "unknown",
  "hills",
  "wetlands",
  "mountains",
  "flatland",
  "lakes",
  "plateau",
  "ocean",
  "coastal_ocean",
  "narrows",
  "inland_sea",
  "ocean_wasteland",
  "mountain_wasteland",
  "high_lakes",
  "atoll",
  "salt_pans",
  "deep_ocean",
  "dune_wasteland",
  "flatland_wasteland",
  "hills_wasteland",
  "mesa_wasteland",
  "plateau_wasteland",
  "wetlands_wasteland",
]);

const ZodVegetation = z.nullable(
  z.enum([
    "farmland",
    "forest",
    "woods",
    "grasslands",
    "sparse",
    "jungle",
    "desert",
  ]),
);

const ZodLocationRank = z.enum(["rural", "town", "city"]);

const ZodLocationHierarchy = z.object({
  continent: z.string(),
  subcontinent: z.string(),
  region: z.string(),
  area: z.string(),
  province: z.string(),
});

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
  vegetation: ZodVegetation.default(null).optional(),
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

export type ILocationHierarchy = z.infer<typeof ZodLocationHierarchy>;

export type Topography = z.infer<typeof ZodTopography>;

export type Vegetation = z.infer<typeof ZodVegetation>;

export type LocationRank = z.infer<typeof ZodLocationRank>;
