import { z } from "zod";

import { ZodGameState } from "@/app/lib/types/gameState";
import { ZodEdgeType } from "@/app/lib/types/pathfinding";

export const ZodWorkerTaskcomputeShortestPathFromProximitySourcePayload =
  z.object({
    gameState: ZodGameState,
    targetLocationName: z.string(),
  });

export type IWorkerTaskcomputeShortestPathFromProximitySourcePayload = z.infer<
  typeof ZodWorkerTaskcomputeShortestPathFromProximitySourcePayload
>;

export const ZodWorkerTaskcomputeShortestPathFromProximitySourceResult =
  z.object({
    location: z.string(),
    shortestPath: z
      .object({
        sourceLocation: z.string(),
        proximity: z.number(),
        path: z.array(
          z.object({
            from: z.string(),
            to: z.string(),
            edgeType: ZodEdgeType,
            cost: z.number(),
          }),
        ),
      })
      .nullable(),
  });

export type IWorkerTaskcomputeShortestPathFromProximitySourceResult = z.infer<
  typeof ZodWorkerTaskcomputeShortestPathFromProximitySourceResult
>;
