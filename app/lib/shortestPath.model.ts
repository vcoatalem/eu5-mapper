import { Observable } from "./observable";
import type { Model, ModelInitArgs } from "./types/model";
import { LocationIdentifier } from "./types/general";
import { EdgeType } from "./types/pathfinding";
import { workerManager } from "@/app/lib/workerManager";
import { GameStateModel } from "./gameState.model";
import { ZodWorkerTaskcomputeShortestPathFromProximitySourceResult } from "@/workers/types/shortestPath";

export interface IShortestPathResult {
  result: Record<
    LocationIdentifier,
    {
      status: "pending" | "completed" | "error" | "needs_update";
      proximityResult: {
        path: Array<{
          throughLocation: LocationIdentifier;
          cost: number;
          through: EdgeType;
        }>;
        sourceLocation: LocationIdentifier;
        proximity: number;
      } | null;
    }
  >;
}

export class ShortestPathModel
  extends Observable<IShortestPathResult>
  implements Model<IShortestPathResult>
{
  public constructor(private gameState: GameStateModel) {
    super();
    this.subject = {
      result: {},
    };
    this.notifyListeners();
  }

  public init({ params }: ModelInitArgs): void {
    params.createManagedSubscription(workerManager, ({ lastCompletedTask }) => {
      if (!lastCompletedTask) return;
      if (lastCompletedTask.type !== "computeShortestPathFromProximitySource")
        return;

      const data =
        ZodWorkerTaskcomputeShortestPathFromProximitySourceResult.parse(
          lastCompletedTask.data,
        );
      const shortestPath = data.shortestPath;

      this.subject.result[data.location] = {
        status: "completed",
        proximityResult: shortestPath
          ? {
              path: shortestPath.path.map((step) => ({
                throughLocation: step.to,
                cost: step.cost,
                through: step.edgeType,
              })),
              sourceLocation: shortestPath.sourceLocation,
              proximity: shortestPath.proximity,
            }
          : null,
      };

      console.log(
        "[ShortestPathModel] Received shortest path result for location",
        {
          location: data.location,
          shortestPath: data.shortestPath,
        },
      );
      this.notifyListeners();
    });

    params.createManagedSubscription(this.gameState, () => {
      let changed = false;
      for (const locationName in this.subject.result) {
        const currentStatus = this.subject.result[locationName].status;
        if (currentStatus === "completed") {
          this.subject.result[locationName].status = "needs_update";
          changed = true;
        }
      }
      if (changed) {
        this.notifyListeners();
      }
    });
  }

  public launchComputeShortestPathFromProximitySourceTask(
    locationName: LocationIdentifier,
  ): void {
    if (this.subject.result[locationName]?.status === "completed") {
      return;
    }

    this.subject.result[locationName] = {
      ...this.subject.result[locationName],
      status: "pending",
    };
    this.notifyListeners();

    workerManager.queueTask({
      id: `computeShortestPathFromProximitySource-${locationName}-${Date.now()}`,
      type: "computeShortestPathFromProximitySource",
      payload: {
        targetLocationName: locationName,
        gameState: this.gameState.getSnapshot(),
      },
    });
  }
}
