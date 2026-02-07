import { useContext } from "react";
import { AppContext } from "../appContextProvider";
import { WorkerStatusComponent } from "./workerStatus.component";
import { LocationSearchBar } from "./locationSearchBar.component";
import { PathfindingInfosComponent } from "@/app/components/pathfindingInfos.component";

export function HeaderComponent() {
  const { gameData } = useContext(AppContext);
  if (!gameData) return;

  return (
    <div className="w-full h-10 flex flex-row items-center">
      <PathfindingInfosComponent/>
      <div className="ml-auto flex flex-row items-center">
        <LocationSearchBar className="w-52"/>
        <WorkerStatusComponent className="w-32"/>
      </div>
    </div>
  );
}
