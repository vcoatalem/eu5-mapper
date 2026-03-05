import { IGameState } from "@/app/lib/types/gameState";
import { ICoordinate, ILocationIdentifier } from "@/app/lib/types/general"; // TODO: try to remove this import of domain logic into worker types
import { EdgeType, PathfindingResult } from "@/app/lib/types/pathfinding";

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
  | "computeNeighbors"
  | "computeShortestPathFromProximitySource";

export interface IWorkerManagerStatus {
  activeTasks: number;
  queuedTasks: number;
  lastCompletedTask: IWorkerTaskResult | null;
  lastSlowTask: { taskId: string; type: TaskType } | null;
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
  coordinates: Record<ILocationIdentifier, ICoordinate[]>;
}

export interface IWorkerTaskColorSearchResult {
  result: Record<ILocationIdentifier, ICoordinate[]>;
}

export interface IWorkerTaskInitGraphWorkerPayload {
  // Potentially add parameters for graph initialization here
}

export interface IWorkerTaskComputeProximityPayload {
  gameState: IGameState;
}

export interface IWorkerTaskComputeProximityResult {
  result: PathfindingResult;
}

export interface IWorkerTaskComputeNeighborsPayload {
  gameState: IGameState;
  locationName: ILocationIdentifier;
}

export interface IWorkerTaskComputeNeighborsResult {
  locationName: ILocationIdentifier;
  neighbors: PathfindingResult;
}

export interface IWorkerTaskcomputeShortestPathFromProximitySourcePayload {
  gameState: IGameState;
  targetLocationName: ILocationIdentifier;
}

export interface IWorkerTaskcomputeShortestPathFromProximitySourceResult {
  location: ILocationIdentifier;
  shortestPath: {
    sourceLocation: ILocationIdentifier;
    proximity: number;
    path: Array<{
      from: ILocationIdentifier;
      to: ILocationIdentifier;
      edgeType: EdgeType;
      cost: number;
    }>;
  } | null;
}
