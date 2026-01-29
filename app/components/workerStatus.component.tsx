import { memo, useSyncExternalStore } from "react";
import { workerManager } from "@/app/workers/workerManager";

export const WorkerStatusComponent = memo(function WorkerStatusComponent() {
  const workerStatus = useSyncExternalStore(
    workerManager.subscribe.bind(workerManager),
    () => workerManager.getSnapshot(),
  );
  return (
    <div className={`text-sm`}>
      <div>Tasks: {workerStatus.activeTasks} active</div>
      <div>Queue: {workerStatus.queuedTasks}</div>
    </div>
  );
});
