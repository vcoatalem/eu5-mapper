export type WorkerManagerConfig = {
  workers: Array<{
    workerFileName: string;
    poolSize: number;
  }>;
  taskWorkerMapping: Record<TaskType, string>; // task type to worker file name
};

export type TaskType = "dummy" | "colorSearch" | "initWithImage";

export interface IWorkerManagerStatus {
  activeTasks: number;
  queuedTasks: number;
  lastCompletedTask: IWorkerTaskResult | null;
}

export interface IWorkerTask {
  id: string;
  type: TaskType;
  payload: unknown;
}

export interface IWorkerTaskResult {
  taskId: string;
  type: TaskType;
  success: boolean;
  error: string | null;
  data: unknown;
}

export interface IWorkerMessage {
  taskType: TaskType;
  type: "log" | "result" | "error";
  taskId: string;
  data?: unknown;
  message?: string;
}

export interface IWorkerTaskInitWithImagePayload {
  canvasWidth: number;
  canvasHeight: number;
  pixelDataBuffer: ArrayBuffer;
}

export interface IWorkerTaskColorSearchPayload {
  canvasWidth: number;
  canvasHeight: number;
  locationName: string;
  startCoordinates?: { x: number; y: number };
}
