import { Observable } from "./observable";
import type { Model, ModelInitArgs } from "./types/model";
import { LocationIdentifier } from "./types/general";
import { workerManager } from "@/app/lib/workerManager";
import { GameStateModel } from "@/app/lib/gameState.model";
import { PathfindingResult } from "./types/pathfinding";
import { ArrayHelper } from "@/app/lib/array.helper";
import { ZodWorkerTaskComputeNeighborsResult } from "@/workers/types/computeNeighbors";

export type NeighborsProximityResults = {
  computationResults: Record<
    LocationIdentifier,
    {
      neighbors: PathfindingResult;
      status: "pending" | "completed" | "error" | "needs_update";
    }
  >;
};

export class NeighborsProximityModel
  extends Observable<NeighborsProximityResults>
  implements Model<NeighborsProximityResults>
{
  private lastCompletedTaskId: string | null = null;

  constructor(private gameState: GameStateModel) {
    super();
    this.subject = {
      computationResults: {},
    };
  }

  public init({ params }: ModelInitArgs): void {
    params.createManagedSubscription(workerManager, ({ lastCompletedTask }) => {
      if (!lastCompletedTask) return;
      if (lastCompletedTask.type !== "computeNeighbors") return;
      if (lastCompletedTask.taskId === this.lastCompletedTaskId) return;

      this.lastCompletedTaskId = lastCompletedTask.taskId;

      const data = ZodWorkerTaskComputeNeighborsResult.parse(
        lastCompletedTask.data,
      );

      this.subject.computationResults[data.locationName] = {
        neighbors: data.neighbors,
        status: "completed",
      };

      this.notifyListeners();
    });

    params.createManagedSubscription(this.gameState, () => {
      this.subject = {
        computationResults: ArrayHelper.reduceToRecord(
          Object.entries(this.subject.computationResults),
          ([locationName]) => locationName,
          ([, resultData]) => ({
            neighbors: resultData.neighbors,
            status: "needs_update",
          }),
        ),
      };
      this.notifyListeners();
    });
  }

  public launchGetNeighborsProximity(locationName: LocationIdentifier): void {
    if (this.subject.computationResults[locationName]?.status === "pending") {
      return;
    }
    if (this.subject.computationResults[locationName]?.status === "completed") {
      this.subject = { ...this.subject };
      this.notifyListeners();
      return;
    }

    this.subject.computationResults[locationName] = {
      neighbors: this.subject.computationResults[locationName]?.neighbors ?? {},
      status: "pending",
    };
    this.notifyListeners();
    workerManager.queueTask({
      id: `computeNeighbors-${locationName}-${Date.now()}`,
      type: "computeNeighbors",
      payload: {
        locationName,
        gameState: this.gameState.getSnapshot(),
      },
    });
  }
}
