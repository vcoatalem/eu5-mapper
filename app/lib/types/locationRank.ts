import { z } from "zod";

export const ZodLocationRank = z.enum(["rural", "town", "city"]);

export type LocationRank = z.infer<typeof ZodLocationRank>;
