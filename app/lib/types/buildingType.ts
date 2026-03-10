import { z } from "zod";

export const ZodBuildingType = z.enum(["rural", "urban", "city", "common"]);

export type BuildingType = z.infer<typeof ZodBuildingType>;
