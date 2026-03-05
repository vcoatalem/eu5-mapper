import { Observable } from "./observable";
import { ILocationIdentifier } from "./types/general";
import { EdgeType } from "./types/pathfinding";
import { workerManager } from "@/app/lib/workerManager";
import { gameStateController } from "./gameState.controller";
import { ZodWorkerTaskcomputeShortestPathFromProximitySourceResult } from "@/workers/types/shortestPath";

export interface IShortestPathResult {
  result: Record<
    ILocationIdentifier,
    {
      status: "pending" | "completed" | "error" | "needs_update";
      proximityResult: {
        path: Array<{
          throughLocation: ILocationIdentifier;
          cost: number;
          through: EdgeType;
        }>;
        sourceLocation: ILocationIdentifier;
        proximity: number;
      } | null;
    }
  >;
}

class ShortestPatchController extends Observable<IShortestPathResult> {
  private unsubscribeWorkerManager: (() => void) | null = null;
  private unsubscribeGameState: (() => void) | null = null;

  public constructor() {
    super();
    this.subject = {
      result: {},
    };
    this.notifyListeners();
  }

  public init(): void {
    this.unsubscribeWorkerManager?.();
    this.unsubscribeGameState?.();
    this.unsubscribeWorkerManager = null;
    this.unsubscribeGameState = null;

    this.unsubscribeWorkerManager = workerManager.subscribe(
      ({ lastCompletedTask }) => {
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
          "[ShortestPathController] Received shortest path result for location",
          {
            location: data.location,
            shortestPath: data.shortestPath,
          },
        );
        this.notifyListeners();
      },
    );

    this.unsubscribeGameState = gameStateController.subscribe(() => {
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
    locationName: ILocationIdentifier,
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
        gameState: gameStateController.getSnapshot(),
      },
    });
  }
}

export const shortestPathController = new ShortestPatchController();

export const debouncedShortestPathController =
  shortestPathController.debounce(10);
