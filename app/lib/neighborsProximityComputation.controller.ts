import { IWorkerTaskComputeNeighborsResult } from "@/workers/types/workerTypes";
import { Observable } from "./observable";
import { ILocationIdentifier } from "./types/general";
import { workerManager } from "@/app/lib/workerManager";
import { gameStateController } from "@/app/lib/gameState.controller";

type NeighborsProximityComputationResults = {
  computationResults: Record<
    ILocationIdentifier,
    {
      neighbors: Record<ILocationIdentifier, number>;
      status: "pending" | "completed" | "error" | "needs_update"; // TODO : detect when result expire and need to be recomputed
    }
  >;
};

class NeighborProximityComputationController extends Observable<NeighborsProximityComputationResults> {
  constructor() {
    super();
    this.subject = {
      computationResults: {},
    };
  }

  public init(): void {
    workerManager.subscribe(({ lastCompletedTask }) => {
      if (!lastCompletedTask) return;
      if (lastCompletedTask.type !== "computeNeighbors") return;

      const data = lastCompletedTask.data as IWorkerTaskComputeNeighborsResult;

      console.log("got completed task data:", data);

      this.subject.computationResults[data.locationName] = {
        neighbors: data.neighbors,
        status: "completed",
      };

      this.notifyListeners();
    });
  }

  public launchGetNeighborProximityTask(
    locationName: ILocationIdentifier,
  ): void {
    this.subject.computationResults[locationName] = {
      neighbors: {},
      status: "pending",
    };
    this.notifyListeners();
    workerManager.queueTask({
      id: `computeNeighbors-${locationName}-${Date.now()}`,
      type: "computeNeighbors",
      payload: {
        locationName,
        gameState: gameStateController.getSnapshot(), //TODO:find better than this
      },
    });
  }
}

export const neighborsProximityComputationController =
  new NeighborProximityComputationController();
