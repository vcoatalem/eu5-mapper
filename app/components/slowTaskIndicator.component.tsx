import { memo, useEffect, useState, useSyncExternalStore } from "react";
import { workerManager } from "@/app/lib/workerManager";
import { TaskType } from "@/workers/types/workerTypes";
import Loadable from "next/dist/shared/lib/loadable.shared-runtime";
import { Loader } from "@/app/components/loader.component";
import { GuiElement } from "@/app/components/guiElement";

export function SlowTaskIndicator(props: { className?: string }) {

    const [slowTask, setSlowTask] = useState<{ taskId: string; type: TaskType } | null>(null);

    const workerStatus = useSyncExternalStore(
      workerManager.subscribe.bind(workerManager),
      () => workerManager.getSnapshot(),
    );

    useEffect(() => {
      if (workerStatus.lastSlowTask && workerStatus.lastSlowTask?.taskId !== slowTask?.taskId) {
        console.log("[SlowTaskIndicator] Setting slow task", workerStatus.lastSlowTask);
        queueMicrotask(() => setSlowTask(workerStatus.lastSlowTask));
      }
    }, [workerStatus.lastSlowTask]);

    useEffect(() => {
      if (slowTask && workerStatus.lastCompletedTask?.taskId === slowTask.taskId) {
        console.log("[SlowTaskIndicator] Resetting slow task", workerStatus.lastSlowTask);
        queueMicrotask(() => setSlowTask(null));
      }
    }, [slowTask, workerStatus.lastCompletedTask]);

    if (!slowTask) {
      return null;
    }

    return (
      <GuiElement className={props.className}>
        <Loader size={16} />
      </GuiElement>
    )
  };
