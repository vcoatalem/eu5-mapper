export type TaskType = "colorSearch" | "initWithImage";

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
  type: "log" | "result" | "error";
  taskId?: string;
  data?: unknown;
  message?: string;
}
