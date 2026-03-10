import { z } from "zod";

import { ZodTaskType } from "@/workers/types/task";

export const ZodWorkerMessage = z.object({
  taskType: ZodTaskType,
  type: z.enum(["log", "result", "error"]),
  taskId: z.string(),
  data: z.unknown().optional(),
  message: z.string().optional(),
});

export type IWorkerMessage = z.infer<typeof ZodWorkerMessage>;
