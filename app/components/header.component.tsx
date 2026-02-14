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
import {
  changeCapitalController,
  IChangeCapitalState,
} from "../lib/changeCapital.controller";

function RegularHeader() {
  const gameState = useSyncExternalStore(
    // TODO: put a special subject in gameStateController for Country changes ?
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  const gameData = useContext(AppContext).gameData;
  if (!gameData) return null;

  const [chooseCountryModalOpen, setChooseCountryModalOpen] =
    React.useState(false);
  return (
    <div className={styles.header}>
      <GameVersionSelector />
      <MethodologyInfos />
      <button
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hover:bg-stone-600 px-4 py-2 rounded-md"
        onClick={() => setChooseCountryModalOpen(true)}
      >
        {(gameState.countryCode &&
          gameData.countriesDataMap[gameState.countryCode]?.name) ||
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
    </div>
  );
}

function RoadBuildingHeader() {
  return (
    <div className={styles.header + " " + styles.roadBuildingStripes}>
      <div className={"mx-auto flex items-center gap-2 px-4 bg-black"}>
        <div className="px-4 py-1 text-xl mx-auto">
          Road Building Mode - Click on a location to start building a new road
        </div>
        <button
          className="text-black bg-yellow-500 hover:bg-yellow-600 rounded-lg px-4 my-1"
          onClick={() => roadBuilderController.toggleBuildingMode()}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ChangeCapitalHeader(props: {
  changeCapitalState: IChangeCapitalState;
}) {
  return (
    <div className={styles.header + " " + styles.roadBuildingStripes}>
      <div className={"mx-auto flex items-center gap-2 px-4 bg-black"}>
        <div className="px-4 py-1 text-xl mx-auto">
          Change Capital Mode - Click on a location to set it as the new capital
        </div>
        <button className="text-black bg-yellow-500 hover:bg-yellow-600 rounded-lg px-4 my-1">
          Cancel
        </button>
      </div>
      <Modal
        isOpen={!!props.changeCapitalState.needConfirmationForLocation}
        onClose={() => changeCapitalController.toggleChangeCapitalMode()}
      >
        <div
          className={
            "min-w-64 min-h-32 flex flex-col gap-4 items-center justify-center p-4"
          }
        >
          <span className="text-lg">
            Change capital to{" "}
            <span className="text-yellow-500 font-bold">
              {props.changeCapitalState.needConfirmationForLocation} ?
            </span>
          </span>
          <div className="w-full flex flex-row gap-2 items-center justify-center">
            <button
              className="bg-yellow-400 hover:bg-yellow-500 rounded-md px-2 py-1 min-w-16 text-black font-bold"
              onClick={() => changeCapitalController.confirmChangeCapital()}
            >
              Yes
            </button>
            <button
              onClick={() => changeCapitalController.toggleChangeCapitalMode()}
              className="border border white px-2 py-1 min-w-16 hover:bg-stone-600 text-white rounded-md font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function HeaderComponent() {
  const { gameData } = useContext(AppContext);

  const buildingRoadState = useSyncExternalStore(
    roadBuilderController.subscribe.bind(roadBuilderController),
    () => roadBuilderController.getSnapshot(),
  );

  const changeCapitalState = useSyncExternalStore(
    changeCapitalController.subscribe.bind(changeCapitalController),
    () => changeCapitalController.getSnapshot(),
  );

  const gameState = useSyncExternalStore(
    // TODO: put a special subject in gameStateController for Country changes ?
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  if (!gameData) return;

  if (buildingRoadState.isBuildingModeEnabled) {
    return <RoadBuildingHeader />;
  }

  if (changeCapitalState.isModeEnabled) {
    return <ChangeCapitalHeader changeCapitalState={changeCapitalState} />;
  }

  return <RegularHeader />;
}
