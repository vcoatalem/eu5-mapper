import { z } from "zod";

export const ZodWorkerTaskInitWithImagePayload = z.object({
  canvasWidth: z.number(),
  canvasHeight: z.number(),
  pixelDataBuffer: z.instanceof(ArrayBuffer),
});

export type IWorkerTaskInitWithImagePayload = z.infer<
  typeof ZodWorkerTaskInitWithImagePayload
>;
