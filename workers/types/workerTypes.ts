import {
  ICoordinate,
  IGameState,
  ILocationIdentifier,
} from "@/app/lib/types/general";

export type WorkerManagerConfig = {
  workers: Array<{
    workerFileName: string;
    poolSize: number;
  }>;
  taskWorkerMapping: Record<TaskType, string>; // task type to worker file name
};

export type TaskType =
  | "dummy"
  | "colorSearch"
  | "initWithImage"
  | "initGraphWorker"
  | "computeProximity"
  | "computeNeighbors";

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

export interface IWorkerTaskColorSearchResult {
  locationName: ILocationIdentifier;
  coordinates: ICoordinate[];
}

export interface IWorkerTaskInitGraphWorkerPayload {
  // Potentially add parameters for graph initialization here
}

export interface IWorkerTaskComputeProximityPayload {
  gameState: IGameState;
}

export interface IWorkerTaskComputeNeighborsPayload {
  gameState: IGameState;
  locationName: ILocationIdentifier;
}

export interface IWorkerTaskComputeNeighborsResult {
  locationName: ILocationIdentifier;
  neighbors: Record<ILocationIdentifier, number>;
}
