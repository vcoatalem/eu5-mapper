// Worker infrastructure types - domain agnostic

export interface WorkerTaskCallbacks {
  onSuccess: (result: unknown) => void;
  onError: (error: Error) => void;
  onProgress?: (progress: WorkerProgress) => void;
}

export interface WorkerTask {
  id: string;
  type: string;
  payload: unknown;
  callbacks?: WorkerTaskCallbacks;
}

export interface WorkerProgress {
  taskId: string;
  percentage: number;
  message?: string;
}

export interface WorkerTaskResult {
  taskId: string;
  type: string;
  result: unknown;
}

export interface WorkerTaskError {
  taskId: string;
  error: string;
}

export interface WorkerMessage {
  type: "log" | "result" | "error" | "progress";
  taskId?: string;
  data?: unknown;
  message?: string;
}

export interface IWorkerManagerObserver {
  onTasksChanged: (activeTasks: number, queuedTasks: number) => void;
}
