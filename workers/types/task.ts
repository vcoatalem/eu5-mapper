import { z } from "zod";

export const ZodTaskType = z.enum([
  "colorSearch",
  "initWithImage",
  "initGraphWorker",
  "computeProximity",
  "computeNeighbors",
  "computeShortestPathFromProximitySource",
]);

export type TaskType = z.infer<typeof ZodTaskType>;

export const ZodWorkerTask = z.object({
  id: z.string(),
  type: ZodTaskType,
  payload: z.unknown(),
});

export type IWorkerTask = z.infer<typeof ZodWorkerTask>;

export const ZodWorkerTaskResult = z.object({
  taskId: z.string(),
  type: ZodTaskType,
  success: z.boolean(),
  error: z.string().nullable(),
  data: z.unknown(),
});

export type IWorkerTaskResult = z.infer<typeof ZodWorkerTaskResult>;
