import { TaskType } from "@/workers/types/task";

interface WorkerManagerConfig {
  workers: Array<{
    workerFileName: string;
    poolSize: number;
  }>;
  taskWorkerMapping: Record<TaskType, string>; // task type to worker file name
}

export const workerManagerConfig: WorkerManagerConfig = {
  workers: [
    { workerFileName: "canvas-worker", poolSize: 2 },
    { workerFileName: "graph-worker", poolSize: 1 },
  ],
  taskWorkerMapping: {
    colorSearch: "canvas-worker",
    initWithImage: "canvas-worker",
    initGraphWorker: "graph-worker",
    computeProximity: "graph-worker",
    computeNeighbors: "graph-worker",
    computeShortestPathFromProximitySource: "graph-worker",
  },
};
