import { z } from "zod";

export const ZodTopography = z.enum([
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

export type Topography = z.infer<typeof ZodTopography>;
