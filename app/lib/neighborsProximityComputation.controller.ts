import { Observable } from "./observable";
import { ILocationIdentifier } from "./types/general";
import { workerManager } from "@/app/lib/workerManager";
import { gameStateController } from "@/app/lib/gameState.controller";
import { PathfindingResult } from "./types/pathfinding";
import { ArrayHelper } from "@/app/lib/array.helper";
import { ZodWorkerTaskComputeNeighborsResult } from "@/workers/types/computeNeighbors";

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
  private unsubscribeWorkerManager: (() => void) | null = null;
  private unsubscribeGameState: (() => void) | null = null;

  constructor() {
    super();
    this.subject = {
      computationResults: {},
    };
  }

  public init(): void {
    this.unsubscribeWorkerManager?.();
    this.unsubscribeGameState?.();
    this.unsubscribeWorkerManager = null;
    this.unsubscribeGameState = null;

    this.unsubscribeWorkerManager = workerManager.subscribe(
      ({ lastCompletedTask }) => {
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
      },
    );

    this.unsubscribeGameState = gameStateController.subscribe(() => {
      // invalidate all results

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
