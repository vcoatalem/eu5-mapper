import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { editModeController, EditMode } from "@/app/lib/editMode.controller";
import Image from "next/image";
import { useCallback, useState, useSyncExternalStore } from "react";
import { IoStarSharp } from "react-icons/io5";
import { MdAnchor } from "react-icons/md";
import { TbListDetails } from "react-icons/tb";
import { Modal } from "../lib/modal/modal.component";
import { DetailedLocationListModal } from "./detailedList/detailedLocationListModal.component";
import { CountryModifiersModal } from "@/app/components/countryBuffs/countryModifiersModal.component";
import { IoIosFlask } from "react-icons/io";
import { BsBrush } from "react-icons/bs";
import { Popover } from "@/app/lib/popover/popover.component";
import buttonStyles from "@/app/styles/button.module.css";

export function MainActionsBar() {

  const editModeState = useSyncExternalStore(
    editModeController.subscribe.bind(editModeController),
    () => editModeController.getSnapshot(),
  );

  const [isDetailedLocationViewOpen, setIsDetailedLocationViewOpen] =
    useState(false);

  const [isCountryBuffsModalOpen, setIsCountryBuffsModalOpen] = useState(false);

  const toggleMode = useCallback((mode: EditMode) => {
    switch (mode) {
      case "capital":
        editModeController.toggleCapitalMode();
        break;
      case "road":
        editModeController.toggleRoadMode();
        break;
      case "maritime":
        editModeController.toggleMaritimeMode();
        break;
      case "acquire":
        editModeController.enableAcquireMode();
        break;
    }
  }, []);

  return (
    <div className="flex flex-row gap-2 items-center">
      <ButtonWithTooltip className="h-10 relative" tooltip="Toggle capital location edition" isActive={editModeState.modeEnabled === 'capital'} onClick={() => toggleMode("capital")}>
        <Image src="/gui/icons/city_capital.png" alt="Enter capital location edition mode" width={24} height={24} />
      </ButtonWithTooltip>

      <ButtonWithTooltip className="h-10 relative" tooltip="Toggle road building edition" isActive={editModeState.modeEnabled === 'road'} onClick={() => toggleMode("road")}>
        <Image
          src="/gui/icons/gravel_road.png"
          alt="Enter build road mode"
          width={24}
          height={24}
        ></Image>
      </ButtonWithTooltip>

      <ButtonWithTooltip className="h-10 relative" tooltip="Toggle maritime presence edition" isActive={editModeState.modeEnabled === 'maritime'} onClick={() => toggleMode("maritime")}>
        <Image src="/gui/icons/maritime_presence.png" alt="Enter maritime presence edition mode" width={24} height={24} />
        {/* <MdAnchor color="white" size={24}></MdAnchor> */}
      </ButtonWithTooltip>

      <ButtonWithTooltip disabled={editModeState.modeEnabled !== 'acquire'} className="h-10 relative" tooltip="Open detailed location view" onClick={() => setIsDetailedLocationViewOpen(true)}>
        <Image src="/gui/icons/building.png" alt="Open detailed location view" width={24} height={24} />
      </ButtonWithTooltip>

      <ButtonWithTooltip disabled={editModeState.modeEnabled !== 'acquire'} className="h-10 relative" tooltip="Open country buffs view" onClick={() => setIsCountryBuffsModalOpen(true)}>
        <Image src="/gui/icons/research.png" alt="Open country modifiers view" width={24} height={24} />
      </ButtonWithTooltip>



      <Popover renderTrigger={({ isOpen, toggle }) => (
        <ButtonWithTooltip disabled={editModeState.modeEnabled !== 'acquire'} isActive={isOpen} className={["h-10 relative rounded-md"].join(" ")} tooltip={"Land acquisition brush size (currently: " + editModeState.acquireLocations.brushSize + ")"} onClick={() => { toggleMode("acquire"); toggle(); }}>
          <Image src="/gui/icons/acquire.png" alt="Choose land acquisition brush size" width={24} height={24} />
        </ButtonWithTooltip>
      )}>
        <div className="flex flex-col gap-2">
          {(["location", "province", "area"] as const).map((size) => (
            <button key={size} className={[buttonStyles.simpleButton, editModeState.acquireLocations.brushSize === size ? buttonStyles.buttonActive : ""].filter(Boolean).join(" ")} onClick={() => editModeController.setBrushSize("acquire", size)}>{size}</button>
          ))}
        </div>
      </Popover>

      <Modal
        onClose={() => setIsDetailedLocationViewOpen(false)}
        isOpen={isDetailedLocationViewOpen}
      >
        <DetailedLocationListModal></DetailedLocationListModal>
      </Modal>

      <Modal
        onClose={() => setIsCountryBuffsModalOpen(false)}
        isOpen={isCountryBuffsModalOpen}
      >
        <CountryModifiersModal onClose={() => setIsCountryBuffsModalOpen(false)}></CountryModifiersModal>
      </Modal>

      <Modal
        isOpen={!!editModeState.capital.askConfirmationForLocation}
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
              {editModeState.capital.askConfirmationForLocation} ?
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

    </div>
  );
}
