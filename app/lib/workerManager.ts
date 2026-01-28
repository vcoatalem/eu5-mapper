import {
  IWorkerTask,
  IWorkerMessage,
  IWorkerManagerStatus,
} from "./workerTypes";
import { Observable } from "./observable";

class WorkerManager extends Observable<IWorkerManagerStatus> {
  private workers: Worker[] = [];
  private taskQueue: IWorkerTask[] = [];
  private activeTasks: Map<string, IWorkerTask> = new Map();
  private workerAssignments: Map<Worker, string | null> = new Map();
  private processedTaskIds: Set<string> = new Set();
  private workerPoolSize: number = 0;
  private workerScriptPath: string = "";

  constructor() {
    super();
    this.subject = {
      activeTasks: 0,
      queuedTasks: 0,
      lastCompletedTask: null,
    };
  }

  public init(workerScriptPath: string, poolSize: number): void {
    this.workerScriptPath = workerScriptPath;
    this.workerPoolSize = Math.max(1, poolSize);
    for (let i = 0; i < this.workerPoolSize; i++) {
      const worker = new Worker(this.workerScriptPath);
      worker.addEventListener("message", (event) =>
        this.handleWorkerMessage(event.data, worker),
      );
      worker.addEventListener("error", (event) =>
        this.handleWorkerError(event, worker),
      );
      this.workers.push(worker);
      this.workerAssignments.set(worker, null); // Mark as available
    }
    console.log(`[WorkerManager] Initialized ${this.workerPoolSize} workers`);
  }

  private updateStatus(
    completedTask?: IWorkerManagerStatus["lastCompletedTask"],
  ): void {
    this.subject = {
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      lastCompletedTask: completedTask ?? this.subject.lastCompletedTask,
    };
    this.notifyListeners();
  }

  public queueTask(task: IWorkerTask): void {
    // Check if task has already been processed
    if (this.processedTaskIds.has(task.id)) {
      console.warn(
        `[WorkerManager] Task ${task.id} has already been processed, skipping`,
      );
      return;
    }

    this.taskQueue.push(task);
    console.log(
      `[WorkerManager] Task queued. Queue size: ${this.taskQueue.length}`,
    );
    this.updateStatus();
    this.processQueue();
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available worker
    const availableWorker = this.workers.find((w) => !this.isWorkerBusy(w));

    if (!availableWorker) {
      console.log(
        `[WorkerManager] No available workers. Queue size: ${this.taskQueue.length}`,
      );
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.activeTasks.set(task.id, task);
    this.workerAssignments.set(availableWorker, task.id); // Assign worker to task
    console.log(`[WorkerManager] Processing task: ${task.id}`);

    // Send task to worker with task ID for tracking
    const messagePayload: Record<string, unknown> = {
      taskId: task.id,
    };

    // Collect transferable objects
    const transferables: Transferable[] = [];

    // Merge payload properties and extract transferables
    if (typeof task.payload === "object" && task.payload !== null) {
      Object.entries(task.payload).forEach(([key, value]) => {
        messagePayload[key] = value;
        // Check if value is a transferable (OffscreenCanvas, ArrayBuffer, etc.)
        if (
          value instanceof OffscreenCanvas ||
          value instanceof ArrayBuffer ||
          value instanceof MessagePort
        ) {
          transferables.push(value);
        }
      });
    }

    // Use transferables if present, otherwise just send message
    if (transferables.length > 0) {
      try {
        availableWorker.postMessage(messagePayload, transferables);
      } catch (error) {
        console.error(
          `[WorkerManager] Error posting message with transferables:`,
          error,
          "Task ID:",
          task.id,
          "Transferables count:",
          transferables.length,
        );
        throw error;
      }
    } else {
      availableWorker.postMessage(messagePayload);
    }

    this.updateStatus();
    // Continue processing if there are more tasks
    this.processQueue();
  }

  private isWorkerBusy(worker: Worker): boolean {
    return this.workerAssignments.get(worker) !== null;
  }

  private handleWorkerMessage(message: IWorkerMessage, worker: Worker): void {
    const taskId = message.taskId;

    if (!taskId) {
      // Log messages without task ID
      if (message.type === "log") {
        console.log("[WORKER]", message.message);
      }
      return;
    }

    const task = this.activeTasks.get(taskId);
    if (!task) {
      console.warn(
        `[WorkerManager] Received message for unknown task: ${taskId}`,
      );
      return;
    }

    switch (message.type) {
      case "log":
        console.log(`[WORKER ${taskId}]`, message.message);
        break;

      case "result":
        //task.callbacks?.onSuccess(message.data);
        this.activeTasks.delete(taskId);
        this.processedTaskIds.add(taskId);
        this.workerAssignments.set(worker, null); // Free up worker
        console.log(`[WorkerManager] Task completed: ${taskId}`);
        this.updateStatus({
          taskId,
          type: task.type,
          success: true,
          error: null,
          data: message.data,
        });
        this.processQueue(); // Process next task in queue
        break;

      case "error":
        //task.callbacks?.onError(new Error(message.message || "Unknown error"));
        this.activeTasks.delete(taskId);
        this.processedTaskIds.add(taskId);
        this.workerAssignments.set(worker, null); // Free up worker
        console.error(`[WorkerManager] Task failed: ${taskId}`);
        this.updateStatus({
          taskId,
          type: task.type,
          success: false,
          error: message.message || "Unknown error",
          data: null,
        });
        this.processQueue(); // Process next task in queue
        break;
    }
  }

  private handleWorkerError(event: ErrorEvent, worker: Worker): void {
    console.error("[WorkerManager] Worker error:", event);
    // In production, would need more sophisticated error recovery
  }

  /*   public getStatus(): {
    activeTasks: number;
    queuedTasks: number;
    poolSize: number;
  } {
    return {
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      poolSize: this.workerPoolSize,
    };
  } */

  public terminate(): void {
    if (this.workers.length === 0) {
      return;
    }
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.taskQueue = [];
    this.activeTasks.clear();
    this.workerAssignments.clear();
    this.processedTaskIds.clear();
    console.log("[WorkerManager] Terminated all workers");
  }

  public clearProcessedTasks(): void {
    this.processedTaskIds.clear();
    console.log("[WorkerManager] Cleared processed task history");
  }
}

export const workerManager = new WorkerManager();
