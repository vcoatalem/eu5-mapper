import {
  IWorkerTask,
  IWorkerMessage,
  IWorkerManagerStatus,
} from "./types/workerTypes";
import { Observable } from "../lib/observable";

class WorkerManager extends Observable<IWorkerManagerStatus> {
  private workers: Worker[] = [];
  private taskQueue: IWorkerTask[] = [];
  private activeTasks: Map<string, IWorkerTask> = new Map();
  private workerAssignments: Map<Worker, string | null> = new Map();
  private processedTaskIds: Set<string> = new Set();
  private workerPoolSize: number = 0;
  private workerScriptName: string = "";

  constructor() {
    super();
    this.subject = {
      activeTasks: 0,
      queuedTasks: 0,
      lastCompletedTask: null,
    };
  }

  /**
   * Initialize the worker pool with a given worker script name (without path) and pool size.
   * The worker script is resolved internally from the dist directory.
   * @param workerScriptName e.g. "canvas-worker.js"
   * @param poolSize number of workers
   */
  public init(workerScriptName: string, poolSize: number): void {
    this.workerScriptName = workerScriptName;
    this.workerPoolSize = Math.max(1, poolSize);
    const workerScriptUrl = this.resolveWorkerScriptUrl(workerScriptName);
    for (let i = 0; i < this.workerPoolSize; i++) {
      const worker = new Worker(workerScriptUrl);
      worker.addEventListener("message", (event) =>
        this.handleWorkerMessage(event.data, worker),
      );
      worker.addEventListener("error", (event) =>
        this.handleWorkerError(event, worker),
      );
      this.workers.push(worker);
      this.workerAssignments.set(worker, null); // Mark as available
    }
    console.log(
      `[WorkerManager] Initialized ${this.workerPoolSize} workers for script: ${workerScriptUrl}`,
    );
  }

  /**
   * Resolves the worker script URL relative to the current module, assuming dist/ subfolder.
   * @param workerScriptName e.g. "canvas-worker.js"
   */
  private resolveWorkerScriptUrl(workerScriptName: string): string {
    // This assumes the dist/ folder is a sibling to this file (workerManager.js)
    // and that the consumer uses import.meta.url context
    // e.g. new URL("./dist/canvas-worker.js", import.meta.url)
    return new URL(`./dist/${workerScriptName}`, import.meta.url).href;
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

    // Collect transferable objects from payload
    const transferables: Transferable[] = [];
    if (typeof task.payload === "object" && task.payload !== null) {
      Object.values(task.payload).forEach((value) => {
        if (
          value instanceof OffscreenCanvas ||
          value instanceof ArrayBuffer ||
          value instanceof MessagePort
        ) {
          transferables.push(value);
        }
      });
    }

    // Send the full IWorkerTask object to the worker
    if (transferables.length > 0) {
      try {
        availableWorker.postMessage(task, transferables);
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
      availableWorker.postMessage(task);
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
        console.error(`[WorkerManager] worker error: ${message.message}`);
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
