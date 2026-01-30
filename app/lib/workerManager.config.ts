import { WorkerManagerConfig } from "../../workers/types/workerTypes";

export const workerManagerConfig: WorkerManagerConfig = {
  workers: [
    { workerFileName: "canvas-worker", poolSize: 2 },
    { workerFileName: "dummy-worker", poolSize: 1 },
  ],
  taskWorkerMapping: {
    dummy: "dummy-worker",
    colorSearch: "canvas-worker",
    initWithImage: "canvas-worker",
  },
};
