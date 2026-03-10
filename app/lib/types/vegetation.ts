import { z } from "zod";

export const ZodVegetation = z.enum([
  "farmland",
  "forest",
  "woods",
  "grasslands",
  "sparse",
  "jungle",
  "desert",
]);

export type Vegetation = z.infer<typeof ZodVegetation>;
