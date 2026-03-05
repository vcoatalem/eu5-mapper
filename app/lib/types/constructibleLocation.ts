import { ZodBuildingInstance } from "@/app/lib/types/buildingInstance";
import { ZodLocationRank } from "@/app/lib/types/locationRank";
import { z } from "zod";

export const ZodConstructibleLocation = z.object({
  rank: ZodLocationRank,
  buildings: z.record(z.string(), ZodBuildingInstance),
});

export type IConstructibleLocation = z.infer<typeof ZodConstructibleLocation>;
