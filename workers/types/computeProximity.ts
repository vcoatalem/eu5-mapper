import { ZodGameState } from "@/app/lib/types/gameState";
import { ZodPathfindingResult } from "@/app/lib/types/pathfinding";
import { z } from "zod";

export const ZodWorkerTaskComputeProximityPayload = z.object({
  gameState: ZodGameState,
});

export type IWorkerTaskComputeProximityPayload = z.infer<
  typeof ZodWorkerTaskComputeProximityPayload
>;

export const ZodWorkerTaskComputeProximityResult = z.object({
  result: ZodPathfindingResult,
});

export type IWorkerTaskComputeProximityResult = z.infer<
  typeof ZodWorkerTaskComputeProximityResult
>;
