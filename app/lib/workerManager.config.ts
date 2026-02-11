import { WorkerManagerConfig } from "../../workers/types/workerTypes";

export const workerManagerConfig: WorkerManagerConfig = {
  workers: [
    { workerFileName: "canvas-worker", poolSize: 2 },
    { workerFileName: "dummy-worker", poolSize: 1 },
    { workerFileName: "graph-worker", poolSize: 1 },
  ],
  taskWorkerMapping: {
    dummy: "dummy-worker",
    colorSearch: "canvas-worker",
    initWithImage: "canvas-worker",
    initGraphWorker: "graph-worker",
    computeProximity: "graph-worker",
    computeNeighbors: "graph-worker",
    computeShortestPathFromProximitySource: "graph-worker",
  },
};
