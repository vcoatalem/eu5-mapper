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
    /* console.log("enter resolveWorkerScriptUrl", { workerScriptName }); */
    const url = "/workers/" + workerScriptName + ".js";
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
    // dont emit the same task completion twice
    this.subject = {
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      lastCompletedTask: null,
    };
  }

  public queueTask(task: IWorkerTask): void {

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
      `[WorkerManager] Task queued. Queue size: ${this.taskQueue.length}`, { task},
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
      
      // Debug: Log pool state
      const assignedCount = Array.from(pool.assignments.values()).filter(
        (a) => a !== null,
      ).length;
      console.log(
        `[WorkerManager] Processing task ${task.id} (type: ${task.type}), pool: ${workerFileName}, workers: ${pool.workers.length}, assigned: ${assignedCount}, available: ${pool.workers.length - assignedCount}`,
      );
      
      const availableWorker = pool.workers.find(
        (w) => pool.assignments.get(w) === null,
      );
      if (availableWorker) {
        this.taskQueue.splice(i, 1);
        this.activeTasks.set(task.id, task);
        pool.assignments.set(availableWorker, task.id);

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
      } else {
        // No available worker - log why
        console.warn(
          `[WorkerManager] No available worker for task ${task.id} (type: ${task.type}). Pool: ${workerFileName}, Total workers: ${pool.workers.length}, All assignments:`,
          Array.from(pool.assignments.entries()).map(([w, taskId]) => ({
            worker: w,
            taskId,
          })),
        );
      }
    }
    // If no available worker for any task, just return
    // (will be retried when a worker becomes available)
  }
  
  /**
   * Clears all worker assignments. Useful when component re-initializes
   * and we want to reset the state without terminating workers.
   * Note: Does NOT clear activeTasks - let them complete naturally.
   * Orphaned completions will be silently ignored.
   */
  public clearAssignments(): void {
    for (const pool of this.workerPools.values()) {
      pool.assignments.clear();
      pool.workers.forEach((worker) => {
        pool.assignments.set(worker, null);
      });
    }
    // Don't clear activeTasks - workers may still be processing them
    // Orphaned completions will be silently ignored in handleWorkerMessage
    console.log("[WorkerManager] Cleared all worker assignments (active tasks will complete naturally)");
  }

  private handleWorkerMessage(message: IWorkerMessage, worker: Worker): void {
    const taskId = message.taskId;

    const task = this.activeTasks.get(taskId);
    if (!task) {
      console.debug('[WorkerManager] ignoring orphaned task completion', { message });
      // Silently ignore orphaned task completions - these happen when component
      // re-initializes and old workers complete tasks that were cleared
      // This is expected behavior and not an error
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
        console.log({
          workerMessage: message.message,
          workerData: message.data,
        });
        console.log();
        break;

      case "result":
        this.activeTasks.delete(taskId);
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
    console.log("[WorkerManager] Terminated all workers");
  }

}

export const workerManager = new WorkerManager();
