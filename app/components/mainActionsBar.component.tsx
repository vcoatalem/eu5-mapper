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
        <IoStarSharp color="white" size={24}></IoStarSharp>
      </ButtonWithTooltip>

      <ButtonWithTooltip className="h-10 relative" tooltip="Toggle road building edition" isActive={editModeState.modeEnabled === 'road'} onClick={() => toggleMode("road")}>
        <Image
          src="/gui/icons/gravel_road.png"
          alt="Enter build road mode"
          width={24}
          height={24}
          style={{ filter: 'grayscale(100%)' }}
        ></Image>
      </ButtonWithTooltip>

      <ButtonWithTooltip className="h-10 relative" tooltip="Toggle maritime presence edition" isActive={editModeState.modeEnabled === 'maritime'} onClick={() => toggleMode("maritime")}>
        <MdAnchor color="white" size={24}></MdAnchor>
      </ButtonWithTooltip>

      <ButtonWithTooltip disabled={editModeState.modeEnabled !== 'acquire'} className="h-10 relative" tooltip="Open detailed location view" onClick={() => setIsDetailedLocationViewOpen(true)}>
        <TbListDetails color="white" size={24}></TbListDetails>
      </ButtonWithTooltip>

      <ButtonWithTooltip disabled={editModeState.modeEnabled !== 'acquire'} className="h-10 relative" tooltip="Open country buffs view" onClick={() => setIsCountryBuffsModalOpen(true)}>
        <IoIosFlask color="white" size={24}></IoIosFlask>
      </ButtonWithTooltip>



      <Popover renderTrigger={({ isOpen, toggle }) => (
        <ButtonWithTooltip disabled={editModeState.modeEnabled !== 'acquire'} isActive={isOpen} className={["h-10 relative rounded-md"].join(" ")} tooltip={"Land acquisition brush size (currently: " + editModeState.acquireLocations.brushSize + ")"} onClick={() => { toggleMode("acquire"); toggle(); }}>
          <BsBrush color="white" size={24}></BsBrush> 
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

    </div>
  );
}
