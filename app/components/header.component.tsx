import { CountrySelectionModal } from "@/app/components/countrySelectionModal.component";
import { GameVersionSelector } from "@/app/components/gameVersionSelector.component";
import { ImportExportGameState } from "@/app/components/importExportGameState.component";
import { MethodologyInfos } from "@/app/components/methodologyInfos.component";
import { useContext, useState, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { editModeController } from "../lib/editMode.controller";
import { gameStateController } from "../lib/gameState.controller";
import { Modal } from "../lib/modal/modal.component";
import styles from "../styles/Gui.module.css";
import buttonStyles from "../styles/button.module.css";

function RegularHeader() {
  const gameState = useSyncExternalStore(
    // TODO: put a special subject in gameStateController for Country changes ?
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const [chooseCountryModalOpen, setChooseCountryModalOpen] = useState(false);
  const gameData = useContext(AppContext).gameData;
  if (!gameData) return null;

  const flagUrl = gameData.countriesDataMap[gameState.countryCode ?? ""]?.flagUrl;

  return (
    <div className={styles.header}>
      <GameVersionSelector />
      <MethodologyInfos />
      <button
        className={["absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-24 hover:grayscale-50", buttonStyles.simpleButton].join(" ")}
        onClick={() => setChooseCountryModalOpen(true)}
        style={{
          backgroundImage: flagUrl ? `url(${flagUrl})` : 'none',
          backgroundSize: '100% auto',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <span className="inset text-center backdrop-blur-sm">
        {(gameState.countryCode &&
          gameData.countriesDataMap[gameState.countryCode]?.name) ||
          "Choose a Country"}
        </span>
 
      </button>
      <Modal
        isOpen={chooseCountryModalOpen}
        onClose={() => setChooseCountryModalOpen(false)}
      >
        <CountrySelectionModal></CountrySelectionModal>
      </Modal>
      <div className="ml-auto w-fit">
        <ImportExportGameState />
      </div>

    </div>

  );
}

export function HeaderComponent() {
  const { gameData } = useContext(AppContext);
  const changeCapitalState = useSyncExternalStore(
    editModeController.capitalSlice.subscribe.bind(editModeController.capitalSlice),
    () => editModeController.capitalSlice.getSnapshot(),
  );

  if (!gameData) return;

  return (
    <>
      <RegularHeader />
      <Modal
        isOpen={!!changeCapitalState.askConfirmationForLocation}
        onClose={() => editModeController.toggleCapitalMode()}
      >
        <div
          className={
            "min-w-64 min-h-32 flex flex-col gap-4 items-center justify-center p-4"
          }
        >
          <span className="text-lg">
            Change capital to{" "}
            <span className="text-yellow-500 font-bold">
              {changeCapitalState.askConfirmationForLocation} ?
            </span>
          </span>
          <div className="w-full flex flex-row gap-2 items-center justify-center">
            <button
              className="bg-yellow-400 hover:bg-yellow-500 rounded-md px-2 py-1 min-w-16 text-black font-bold"
              onClick={() => editModeController.confirmChangeCapital()}
            >
              Yes
            </button>
            <button
              onClick={() => editModeController.toggleCapitalMode()}
              className="border border white px-2 py-1 min-w-16 hover:bg-stone-600 text-white rounded-md font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
