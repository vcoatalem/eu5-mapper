import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { workerManager } from "@/app/lib/workerManager";
import { Loader } from "@/app/components/loader.component";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TaskType } from "@/workers/types/task";

export function SlowTaskIndicator(props: { className?: string }) {
  const [slowTask, setSlowTask] = useState<{
    taskId: string;
    type: TaskType;
  } | null>(null);

  const divRef = useRef<HTMLDivElement | null>(null);

  const workerStatus = useSyncExternalStore(
    workerManager.subscribe.bind(workerManager),
    () => workerManager.getSnapshot(),
  );

  useEffect(() => {
    if (
      workerStatus.lastSlowTask &&
      workerStatus.lastSlowTask?.taskId !== slowTask?.taskId
    ) {
      console.log(
        "[SlowTaskIndicator] Setting slow task",
        workerStatus.lastSlowTask,
      );
      queueMicrotask(() => setSlowTask(workerStatus.lastSlowTask));
    }
  }, [workerStatus.lastSlowTask]);

  useEffect(() => {
    if (
      slowTask &&
      workerStatus.lastCompletedTask?.taskId === slowTask.taskId
    ) {
      console.log(
        "[SlowTaskIndicator] Resetting slow task",
        workerStatus.lastSlowTask,
      );
      queueMicrotask(() => setSlowTask(null));
    }
  }, [slowTask, workerStatus.lastCompletedTask]);

  if (!slowTask) {
    return null;
  }

  return (
    <div className={[props.className, ""].join(" ")}>
      <div ref={divRef} className="relative w-full h-full">
        <Tooltip config={{ preferredVertical: "top" }}>
          <TooltipTrigger>
            <button
              onClick={() => {
                workerManager.clearAssignments();
                setSlowTask(null);
              }}
            >
              <Loader className="cursor-pointer" size={48} />
            </button>
          </TooltipTrigger>
          <TooltipContent anchor={{ type: "dom", ref: divRef }}>
            <div className="max-w-54 flex flex-col gap-1 text-sm">
              <p>
                The following task has been running for some time:{" "}
                <b className="text-stone-400">{slowTask.taskId}</b>
              </p>
              <span>
                <b className="text-yellow-500">Click to cancel ongoing tasks</b>
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
