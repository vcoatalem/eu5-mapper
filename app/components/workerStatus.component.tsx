import { memo, useSyncExternalStore } from "react";
import styles from "../styles/Gui.module.css";
import { workerManager } from "@/app/lib/workerManager";

export const WorkerStatusComponent = memo(function WorkerStatusComponent() {
  const workerStatus = useSyncExternalStore(
    workerManager.subscribe.bind(workerManager),
    () => workerManager.getSnapshot(),
  );
  console.log("worker status component render loop");
  return (
    <div
      className={`${styles.guiElement} text-sm bg-black px-2 py-1 border border-white border-radius-md`}
    >
      <div>Tasks: {workerStatus.activeTasks} active</div>
      <div>Queue: {workerStatus.queuedTasks}</div>
    </div>
  );
});
