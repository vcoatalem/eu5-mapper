import { z } from "zod";

const ZodWorkerTaskInitGraphWorkerPayload = z.object({
  // no payload required for now
});

export type IWorkerTaskInitGraphWorkerPayload = z.infer<
  typeof ZodWorkerTaskInitGraphWorkerPayload
>;
