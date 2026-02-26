import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { CopyrightNotice } from "@/app/components/copyrightNotice.component";
import { CountrySelectionModal } from "@/app/components/countrySelectionModal.component";
import { GameVersionSelector } from "@/app/components/gameVersionSelector.component";
import { ImportExportGameState } from "@/app/components/importExportGameState.component";
import { MethodologyInfos } from "@/app/components/methodologyInfos.component";
import { useContext, useState, useSyncExternalStore } from "react";
import { PiCopyrightLight } from "react-icons/pi";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "../lib/gameState.controller";
import { Modal } from "../lib/modal/modal.component";
import styles from "../styles/Gui.module.css";
import buttonStyles from "../styles/button.module.css";
import { PosthogSurveyButton } from "@/app/components/posthogSurveyButton.component";
import { PosthogHelper } from "@/app/lib/utils/posthog.helper";

function RegularHeader() {
  const gameState = useSyncExternalStore(
    // TODO: put a special subject in gameStateController for Country changes ?
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const [chooseCountryModalOpen, setChooseCountryModalOpen] = useState(false);
  const [showCopyrightNotice, setShowCopyrightNotice] = useState(false);
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


      <div className="ml-auto w-fit flex flex-row gap-2 items-center relative">
        {PosthogHelper.isPosthogEnabled() && <PosthogSurveyButton className="" />}
        <ButtonWithTooltip tooltip="show copyright notice" isActive={showCopyrightNotice} onClick={() => setShowCopyrightNotice((prev) => !prev)}>
          <PiCopyrightLight color="white" size={24}></PiCopyrightLight>
        </ButtonWithTooltip>
        <Modal
          isOpen={showCopyrightNotice}
          onClose={() => setShowCopyrightNotice(false)}
        >
          <CopyrightNotice />
        </Modal>
        <ImportExportGameState />
      </div>

    </div >

  );
}

export function HeaderComponent() {
  const { gameData } = useContext(AppContext);

  if (!gameData) return;

  return (
    <>
      <RegularHeader />
    </>
  )
}
