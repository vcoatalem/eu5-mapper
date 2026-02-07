import { memo, useSyncExternalStore } from "react";
import { workerManager } from "@/app/lib/workerManager";

export const WorkerStatusComponent = memo(function WorkerStatusComponent(props: { className?: string}) {
  const workerStatus = useSyncExternalStore(
    workerManager.subscribe.bind(workerManager),
    () => workerManager.getSnapshot(),
  );
  return (
    <div className={props.className +  ` text-sm px-2 text-stone-600`}>
      <div>{workerStatus.activeTasks} active tasks</div>
      <div>{workerStatus.queuedTasks} tasks in queue</div>
    </div>
  );
});
