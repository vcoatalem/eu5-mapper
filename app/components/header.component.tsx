import { useContext } from "react";
import { AppContext } from "../appContextProvider";
import { WorkerStatusComponent } from "./workerStatus.component";
import { LocationSearchBar } from "./locationSearchBar.component";
import { PathfindingInfosComponent } from "@/app/components/pathfindingInfos.component";

export function HeaderComponent() {
  const { gameData } = useContext(AppContext);
  if (!gameData) return;

  return (
    <div className="w-full h-10 flex items-center">
      <WorkerStatusComponent />
      <LocationSearchBar />
      <PathfindingInfosComponent className="ml-auto"/>
    </div>
  );
}
