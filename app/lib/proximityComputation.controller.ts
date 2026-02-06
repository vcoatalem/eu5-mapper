import { gameStateController } from "@/app/lib/gameState.controller";
import { IWorkerTaskComputeProximityResult } from "@/workers/types/workerTypes";
import { Observable } from "./observable";
import { ILocationIdentifier } from "./types/general";
import { GraphStats, PathfindingResult } from "./types/pathfinding";
import { workerManager } from "./workerManager";

export interface IProximityComputationResults {
  result: PathfindingResult;
}

export class ProximityComputationController extends Observable<IProximityComputationResults> {
  constructor() {
    super();
  }

  public init(): void {
    console.log("[proximityComputationController] init");
    this.subject = {
      result: {},
    };
    this.notifyListeners();
    workerManager.subscribe((workerManagerStatus) => {
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
      } else if (
        workerManagerStatus.lastCompletedTask?.type === "computeProximity"
      ) {
        const data = workerManagerStatus.lastCompletedTask
          .data as IWorkerTaskComputeProximityResult;
        this.subject.result = data.result;
        console.log(
          "[ProximityComputationController] Proximity computation completed",
          { newState: this.subject },
        );
        this.notifyListeners();
      }
    });
    gameStateController.debounce(10).subscribe((gameState) => {
      workerManager.queueTask({
        id: `computeProximity-${Date.now()}`,
        type: "computeProximity",
        payload: {
          gameState: gameState,
        },
      });
    });
  }
}

export const proximityComputationController =
  new ProximityComputationController();
