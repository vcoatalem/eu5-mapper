import { debouncedGameStateController } from "@/app/lib/gameState.controller";
import { Observable } from "./observable";
import { GraphStats, PathfindingResult } from "./types/pathfinding";
import { workerManager } from "./workerManager";
import {
  ZodWorkerTaskComputeProximityPayload,
  ZodWorkerTaskComputeProximityResult,
} from "@/workers/types/computeProximity";

export interface IProximityComputationResults {
  result: PathfindingResult;
  status: "pending" | "completed" | "error" | "updating";
}

export class ProximityComputationController extends Observable<IProximityComputationResults> {
  private unsubscribeWorkerManager: (() => void) | null = null;
  private unsubscribeGameState: (() => void) | null = null;

  constructor() {
    super();
  }

  public init(): void {
    this.unsubscribeWorkerManager?.();
    this.unsubscribeGameState?.();
    this.unsubscribeWorkerManager = null;
    this.unsubscribeGameState = null;

    this.subject = {
      result: {},
      status: "pending",
    };
    this.notifyListeners();
    this.unsubscribeWorkerManager = workerManager.subscribe(
      (workerManagerStatus) => {
        const stats = (
          workerManagerStatus.lastCompletedTask?.data as {
            graphStats: GraphStats;
          }
        )?.graphStats;
        if (workerManagerStatus.lastCompletedTask?.type === "initGraphWorker") {
          console.log(
            `[ProximityComputationController] Adjacency graph built:`,
            stats,
          );
          console.log(`  - Nodes: ${stats.nodes}`);
          console.log(`  - Total edges: ${stats.edges}`);
          console.log(`  - River edges: ${stats.riverEdges}`);
          console.log(`  - Land edges: ${stats.landEdges}`);
          console.log(`  - Sea edges: ${stats.seaEdges}`);
          console.log(`  - Port edges: ${stats.portEdges}`);
          console.log(`  - Lake edges: ${stats.lakeEdges}`);
          console.log(`  - Port-River edges: ${stats.portRiverEdges}`);
          console.log(`  - Through-Sea edges: ${stats.throughSeaEdges}`);
          console.log(`  - Coastal edges: ${stats.coastalEdges}`);
          console.log(`  - Unknown edges: ${stats.unknownEdges}`);
        } else if (
          workerManagerStatus.lastCompletedTask?.type === "computeProximity"
        ) {
          const data = ZodWorkerTaskComputeProximityResult.parse(
            workerManagerStatus.lastCompletedTask.data,
          );
          this.subject.result = data.result;
          this.subject.status = "completed";
          console.log(
            "[ProximityComputationController] Proximity computation completed",
            { newState: this.subject },
          );
          this.notifyListeners();
        }
      },
    );
    this.unsubscribeGameState = debouncedGameStateController.subscribe(
      (gameState) => {
        this.subject.status = "updating";
        this.notifyListeners();
        workerManager.queueTask({
          id: `computeProximity-${Date.now()}`,
          type: "computeProximity",
          payload: {
            gameState: gameState,
          },
        });
      },
    );
  }
}

export const proximityComputationController =
  new ProximityComputationController();

export const debouncedProximityComputationController =
  proximityComputationController.debounce(100);
