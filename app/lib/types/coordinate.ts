import { z } from "zod";

export const ZodCoordinate = z.object({
  x: z.number(),
  y: z.number(),
});

export type Coordinate = z.infer<typeof ZodCoordinate>;
