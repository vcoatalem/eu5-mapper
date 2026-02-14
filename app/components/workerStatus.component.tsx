import { memo, useSyncExternalStore } from "react";
import { workerManager } from "@/app/lib/workerManager";

export const WorkerStatusComponent = memo(
  function WorkerStatusComponent(props: { className?: string }) {
    const workerStatus = useSyncExternalStore(
      workerManager.subscribe.bind(workerManager),
      () => workerManager.getSnapshot(),
    );
    return (
      <div className={props.className + ` text-sm px-2 text-stone-600`}>
        <div>Tasks</div>
        <div>{workerStatus.activeTasks} active</div>
        <div>{workerStatus.queuedTasks} in queue</div>
      </div>
    );
  },
);
