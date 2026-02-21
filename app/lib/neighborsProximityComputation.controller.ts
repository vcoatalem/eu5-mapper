import { IWorkerTaskComputeNeighborsResult } from "@/workers/types/workerTypes";
import { Observable } from "./observable";
import { ILocationIdentifier } from "./types/general";
import { workerManager } from "@/app/lib/workerManager";
import { gameStateController } from "@/app/lib/gameState.controller";
import { PathfindingResult } from "./types/pathfinding";

type NeighborsProximityComputationResults = {
  computationResults: Record<
    ILocationIdentifier,
    {
      neighbors: PathfindingResult;
      status: "pending" | "completed" | "error" | "needs_update"; // TODO : detect when result expire and need to be recomputed
    }
  >;
};

class NeighborProximityComputationController extends Observable<NeighborsProximityComputationResults> {

  private lastCompletedTaskId: string | null = null;

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
      if (lastCompletedTask.taskId === this.lastCompletedTaskId) return;

      this.lastCompletedTaskId = lastCompletedTask.taskId;

      const data = lastCompletedTask.data as IWorkerTaskComputeNeighborsResult;

      this.subject.computationResults[data.locationName] = {
        neighbors: data.neighbors,
        status: "completed",
      };

      this.notifyListeners();
    });

    gameStateController.subscribe(() => {
      // invalidate all results
      this.subject = {
        computationResults: Object.entries(
          this.subject.computationResults,
        ).reduce(
          (acc, [locationName, result]) => {
            acc[locationName] = {
              neighbors: result.neighbors,
              status: "needs_update",
            };
            return acc;
          },
          {} as Record<
            ILocationIdentifier,
            { neighbors: PathfindingResult; status: "needs_update" }
          >,
        ),
      };
      this.notifyListeners();
    });
  }

  public launchGetNeighborsProximity(locationName: ILocationIdentifier): void {
    if (this.subject.computationResults[locationName]?.status === "pending") {
      // job is still running, wait for it to complete
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
        gameState: gameStateController.getSnapshot(), //TODO: find better than this
      },
    });
  }
}

export const neighborsProximityComputationController =
  new NeighborProximityComputationController();

export const debouncedNeighborsProximityComputationController =
  neighborsProximityComputationController.debounce(100);
