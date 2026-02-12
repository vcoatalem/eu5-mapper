import React, { useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { WorkerStatusComponent } from "./workerStatus.component";
import { LocationSearchBar } from "./locationSearchBar.component";
import { MethodologyInfos } from "@/app/components/methodologyInfos.component";
import { roadBuilderController } from "@/app/lib/roadBuilderController";
import styles from "../styles/Gui.module.css";
import { gameStateController } from "../lib/gameState.controller";
import { Modal } from "../lib/modal/modal.component";
import { CountrySelectionModal } from "@/app/components/countrySelectionModal.component";
import { GameVersionSelector } from "@/app/components/gameVersionSelector.component";

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
        "w-full h-10 flex flex-row items-center relative " +
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
          <GameVersionSelector />
          <MethodologyInfos />
          <button
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hover:bg-stone-600 px-4 py-2 rounded-md"
            onClick={() => setChooseCountryModalOpen(true)}
          >
            {(gameState.country &&
              gameData.countriesDataMap[gameState.countryCode ?? ""]?.name) ||
              "Choose a Country"}
          </button>
          <Modal
            isOpen={chooseCountryModalOpen}
            onClose={() => setChooseCountryModalOpen(false)}
          >
            <CountrySelectionModal></CountrySelectionModal>
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
