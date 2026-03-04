import { z } from "zod";

export const ZodLocationHierarchy = z.object({
  continent: z.string(),
  subcontinent: z.string(),
  region: z.string(),
  area: z.string(),
  province: z.string(),
});

export type ILocationHierarchy = z.infer<typeof ZodLocationHierarchy>;
