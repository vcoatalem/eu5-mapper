import { Observable } from "./observable";
import { IGameData, ILocationIdentifier } from "./types/general";
import { gameStateController } from "@/app/lib/gameState.controller";
import { GraphStats, PathfindingResult } from "./types/pathfinding";
import { CompactGraph } from "./graph";
import { workerManager } from "./workerManager";
import { IWorkerTaskComputeProximityResult } from "@/workers/types/workerTypes";

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
        console.log("got task results", {
          results: workerManagerStatus?.lastCompletedTask,
        });
        const results = workerManagerStatus?.lastCompletedTask.data as Record<
          ILocationIdentifier,
          number
        >;
        this.subject.result = data.result;
        console.log(
          "[ProximityComputationController] Proximity computation completed",
          { newState: this.subject },
        );
        this.notifyListeners();
      }
    });
    gameStateController.subscribe((gameState) => {
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
