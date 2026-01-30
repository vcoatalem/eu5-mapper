import { IWorkerMessage, IWorkerTask } from "./types/workerTypes";

export const sendMessage = (
  self: typeof globalThis,
  payload: {
    data?: unknown;
    message: string;
    level: IWorkerMessage["type"];
    task: IWorkerTask;
  },
): void => {
  const workerMessage: IWorkerMessage = {
    type: payload.level,
    taskType: payload.task.type,
    taskId: payload.task.id,
    message: payload.message
      ? `[${(globalThis as any).__workerName}] ${payload.message}`
      : "",
  };
  if (payload.data !== undefined) {
    workerMessage.data = payload.data;
  }
  self.postMessage(workerMessage);
};
