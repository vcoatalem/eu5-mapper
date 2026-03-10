import { z } from "zod";

import { ZodGameState } from "@/app/lib/types/gameState";
import { ZodPathfindingResult } from "@/app/lib/types/pathfinding";

export const ZodWorkerTaskComputeNeighborsPayload = z.object({
  gameState: ZodGameState,
  locationName: z.string(),
});

export type IWorkerTaskComputeNeighborsPayload = z.infer<
  typeof ZodWorkerTaskComputeNeighborsPayload
>;

export const ZodWorkerTaskComputeNeighborsResult = z.object({
  locationName: z.string(),
  neighbors: ZodPathfindingResult,
});

export type IWorkerTaskComputeNeighborsResult = z.infer<
  typeof ZodWorkerTaskComputeNeighborsResult
>;
