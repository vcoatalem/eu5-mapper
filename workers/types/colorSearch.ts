import { z } from "zod";

import { ZodCoordinate } from "@/app/lib/types/coordinate";

export const ZodWorkerTaskColorSearchPayload = z.object({
  canvasWidth: z.number(),
  canvasHeight: z.number(),
  coordinates: z.record(
    z.string(), // ILocationIdentifier as string
    z.array(ZodCoordinate),
  ),
});

export type IWorkerTaskColorSearchPayload = z.infer<
  typeof ZodWorkerTaskColorSearchPayload
>;

export const ZodWorkerTaskColorSearchResult = z.object({
  result: z.record(
    z.string(), // ILocationIdentifier as string
    z.array(ZodCoordinate),
  ),
});

export type IWorkerTaskColorSearchResult = z.infer<
  typeof ZodWorkerTaskColorSearchResult
>;
