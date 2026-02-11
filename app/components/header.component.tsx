import React, { useContext, useEffect, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { WorkerStatusComponent } from "./workerStatus.component";
import { LocationSearchBar } from "./locationSearchBar.component";
import { PathfindingInfosComponent } from "@/app/components/pathfindingInfos.component";
import { roadBuilderController } from "@/app/lib/roadBuilderController";
import styles from "../styles/Gui.module.css";
import { gameStateController } from "../lib/gameState.controller";
import { Modal } from "../lib/modal/modal.component";
import { CountrySelectionList } from "./countrySelectionList.component";

export function HeaderComponent() {
  const { gameData } = useContext(AppContext);

  const buildingRoadState = useSyncExternalStore(
    roadBuilderController.subscribe.bind(roadBuilderController),
    () => roadBuilderController.getSnapshot(),
  );

  const gameState = useSyncExternalStore(
    // TODO: put a special subject in gameStateController for Country changes ?
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const [chooseCountryModalOpen, setChooseCountryModalOpen] =
    React.useState(false);

  if (!gameData) return;

  return (
    <div
      className={
        "w-full h-10 flex flex-row items-center " +
        (buildingRoadState.isBuildingModeEnabled
          ? styles.roadBuildingStripes
          : "")
      }
    >
      {buildingRoadState.isBuildingModeEnabled ? (
        <div className={"mx-auto flex items-center gap-2 px-4 bg-black"}>
          <div className="px-4 py-1 text-xl mx-auto">
            Road Building Mode - Click on a location to start building a new
            road
          </div>
          <button
            className="text-black bg-yellow-500 hover:bg-yellow-600 rounded-lg px-4 my-1"
            onClick={() => roadBuilderController.toggleBuildingMode()}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <PathfindingInfosComponent />
          <button
            className="absolute mx-auto w-full"
            onClick={() => setChooseCountryModalOpen(true)}
          >
            <span className="hover:bg-stone-600 px-4   py-2 rounded-md">
              {(gameState.country &&
                gameData.countriesDataMap[gameState.countryCode ?? ""]?.name) ||
                "Choose a Country"}
            </span>
          </button>
          <Modal
            isOpen={chooseCountryModalOpen}
            onClose={() => setChooseCountryModalOpen(false)}
          >
            <CountrySelectionList></CountrySelectionList>
          </Modal>
          <div className="ml-auto flex flex-row items-center">
            <LocationSearchBar className="w-52" />
            <WorkerStatusComponent className="w-32" />
          </div>
        </>
      )}
    </div>
  );
}
