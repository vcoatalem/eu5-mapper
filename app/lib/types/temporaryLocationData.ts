import { z } from "zod";

export const ZodTemporaryLocationData = z.object({
  development: z.number().optional(),
  population: z.number().optional(),
  maritimePresence: z.number().optional(),
});

export type ITemporaryLocationData = z.infer<typeof ZodTemporaryLocationData>;
