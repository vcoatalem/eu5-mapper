"use client";

import {
  IWorkerTask,
  IWorkerMessage,
  IWorkerManagerStatus,
  TaskType,
} from "../../workers/types/workerTypes";
import { workerManagerConfig } from "./workerManager.config";
import { Observable } from "./observable";

type WorkerPool = {
  workerFileName: string;
  workers: Worker[];
  assignments: Map<Worker, string | null>; // taskId or null
};

class WorkerManager extends Observable<IWorkerManagerStatus> {
  private workerPools: Map<string, WorkerPool> = new Map(); // workerFileName -> pool
  private taskQueue: IWorkerTask[] = [];
  private activeTasks: Map<string, IWorkerTask> = new Map();
  private processedTaskIds: Set<string> = new Set();

  public isAvailable(): boolean {
    return this.workerPools.size > 0;
  }

  constructor() {
    super();
    this.subject = {
      activeTasks: 0,
      queuedTasks: 0,
      lastCompletedTask: null,
    };

    if (typeof Worker === "undefined") {
      console.info("not initializing WorkerManager server-side");
      return;
    }

    // Initialize worker pools from config
    for (const { workerFileName, poolSize } of workerManagerConfig.workers) {
      const workers: Worker[] = [];
      const assignments: Map<Worker, string | null> = new Map();
      console.log({ workerFileName, poolSize });
      const workerScriptUrl = this.resolveWorkerScriptUrl(workerFileName);
      for (let i = 0; i < poolSize; i++) {
        const worker = new Worker(workerScriptUrl);
        worker.addEventListener("message", (event) =>
          this.handleWorkerMessage(event.data, worker),
        );
        worker.addEventListener("error", (event) =>
          this.handleWorkerError(event, worker),
        );
        workers.push(worker);
        assignments.set(worker, null);
      }
      this.workerPools.set(workerFileName, {
        workerFileName,
        workers,
        assignments,
      });
      console.log(
        `[WorkerManager] Initialized pool: ${workerFileName} (${poolSize} workers)`,
      );
    }
  }

  /**
   * Resolves the worker script URL relative to the current module, assuming dist/ subfolder.
   * @param workerScriptName e.g. "canvas-worker.js"
   */
  private resolveWorkerScriptUrl(workerScriptName: string): string {
    console.log("enter resolveWorkerScriptUrl", { workerScriptName });
    const url = "/workers/" + workerScriptName + ".js";
    console.log(
      `[WorkerManager] Resolving worker script URL for: ${workerScriptName} -> ${url}`,
    );
    // This assumes the dist/ folder is a sibling to this file (workerManager.js)
    // and that the consumer uses import.meta.url context
    return url;
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

    // Find which worker pool should handle this task
    const workerFileName = workerManagerConfig.taskWorkerMapping[task.type];
    if (!workerFileName) {
      console.error(
        `[WorkerManager] No worker registered for task type: ${task.type}`,
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

    // Find the first task that can be assigned to an available worker
    for (let i = 0; i < this.taskQueue.length; i++) {
      const task = this.taskQueue[i];
      const workerFileName = workerManagerConfig.taskWorkerMapping[task.type];
      if (!workerFileName) {
        console.error(
          `[WorkerManager] No worker registered for task type: ${task.type}`,
        );
        continue;
      }
      const pool = this.workerPools.get(workerFileName);
      if (!pool) {
        console.error(`[WorkerManager] No pool for worker: ${workerFileName}`);
        continue;
      }
      const availableWorker = pool.workers.find(
        (w) => pool.assignments.get(w) === null,
      );
      if (availableWorker) {
        this.taskQueue.splice(i, 1);
        this.activeTasks.set(task.id, task);
        pool.assignments.set(availableWorker, task.id);
        console.log(
          `[WorkerManager] Processing task: ${task.id} with worker: ${workerFileName}`,
        );

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
        return;
      }
    }
    // If no available worker for any task, just return
    // (will be retried when a worker becomes available)
  }

  private handleWorkerMessage(message: IWorkerMessage, worker: Worker): void {
    const taskId = message.taskId;

    console.log("got worker message", { message, fromWorker: worker });

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

    if (!message.taskType) {
      console.error("[WorkerManager] Received message without taskType");
      return;
    }
    const pool = this.workerPools.get(
      workerManagerConfig.taskWorkerMapping[message.taskType],
    );
    if (!pool) {
      console.error(
        "[WorkerManager] Could not find pool for worker (taskType: " +
          message.taskType +
          ")",
      );
      return;
    }

    switch (message.type) {
      case "log":
        console.log(`[WORKER ${taskId}]`, message.message);
        break;

      case "result":
        this.activeTasks.delete(taskId);
        this.processedTaskIds.add(taskId);
        pool.assignments.set(worker, null); // Free up worker
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
        this.activeTasks.delete(taskId);
        this.processedTaskIds.add(taskId);
        pool.assignments.set(worker, null); // Free up worker
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
    for (const pool of this.workerPools.values()) {
      pool.workers.forEach((worker) => worker.terminate());
      pool.workers.length = 0;
      pool.assignments.clear();
    }
    this.taskQueue = [];
    this.activeTasks.clear();
    this.processedTaskIds.clear();
    console.log("[WorkerManager] Terminated all workers");
  }

  public clearProcessedTasks(): void {
    this.processedTaskIds.clear();
    console.log("[WorkerManager] Cleared processed task history");
  }
}

export const workerManager = new WorkerManager();
