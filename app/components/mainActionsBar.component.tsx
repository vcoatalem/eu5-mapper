import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { CountryModifiersModal } from "@/app/components/countryBuffs/countryModifiersModal.component";
import { EditMode, editModeController } from "@/app/lib/editMode.controller";
import { Popover } from "@/app/lib/popover/popover.component";
import buttonStyles from "@/app/styles/button.module.css";
import Image from "next/image";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Modal } from "../lib/modal/modal.component";
import { DetailedLocationListModal } from "./detailedList/detailedLocationListModal.component";

interface IMainActionsBarProps {
  isTutorial?: boolean;
}

export function MainActionsBar({ isTutorial }: IMainActionsBarProps) {
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
      <Popover
        renderTrigger={({ isOpen, toggle }) => (
          <ButtonWithTooltip
            disabled={editModeState.modeEnabled !== "acquire"}
            isActive={isOpen}
            className={["h-10 relative rounded-md"].join(" ")}
            tooltip={
              isTutorial
                ? "Use this to add new locations to your realm. You may choose to acquire single locations, or whole areas at once."
                : "Land acquisition brush size (currently: " +
                  editModeState.acquireLocations.brushSize +
                  ")"
            }
            onClick={() => {
              if (isTutorial) return;
              toggleMode("acquire");
              toggle();
            }}
          >
            <Image
              src="/gui/icons/acquire.png"
              alt="Choose land acquisition brush size"
              width={24}
              height={24}
            />
          </ButtonWithTooltip>
        )}
      >
        <div className="flex flex-col gap-2">
          {(["location", "province", "area"] as const).map((size) => (
            <button
              key={size}
              className={[
                buttonStyles.simpleButton,
                editModeState.acquireLocations.brushSize === size
                  ? buttonStyles.buttonActive
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => editModeController.setBrushSize("acquire", size)}
            >
              {size}
            </button>
          ))}
        </div>
      </Popover>

      <ButtonWithTooltip
        className="h-10 relative"
        tooltip={
          isTutorial
            ? "Use this to change the location of your capital."
            : "Toggle capital location edition"
        }
        isActive={editModeState.modeEnabled === "capital"}
        onClick={() => {
          if (isTutorial) return;
          toggleMode("capital");
        }}
      >
        <Image
          src="/gui/icons/city_capital.png"
          alt="Enter capital location edition mode"
          width={24}
          height={24}
        />
      </ButtonWithTooltip>

      <ButtonWithTooltip
        className="h-10 relative"
        tooltip={
          isTutorial
            ? "Use this to build or upgrade roads in your realm."
            : "Toggle road building edition"
        }
        isActive={editModeState.modeEnabled === "road"}
        onClick={() => {
          if (isTutorial) return;
          toggleMode("road");
        }}
      >
        <Image
          src="/gui/icons/gravel_road.png"
          alt="Enter build road mode"
          width={24}
          height={24}
        ></Image>
      </ButtonWithTooltip>

      <ButtonWithTooltip
        className="h-10 relative"
        tooltip={
          isTutorial
            ? "Use this to edit maritime presence in sea locations. By default, maritime location is 50 in coastal areas and 0 in deep sea."
            : "Toggle maritime presence edition"
        }
        isActive={editModeState.modeEnabled === "maritime"}
        onClick={() => {
          if (isTutorial) return;
          toggleMode("maritime");
        }}
      >
        <Image
          src="/gui/icons/maritime_presence.png"
          alt="Enter maritime presence edition mode"
          width={24}
          height={24}
        />
        {/* <MdAnchor color="white" size={24}></MdAnchor> */}
      </ButtonWithTooltip>

      <ButtonWithTooltip
        disabled={editModeState.modeEnabled !== "acquire"}
        className="h-10 relative"
        tooltip={
          isTutorial
            ? "Use this to manage country wide proximity modifiers (e.g advances)"
            : "Open country modifiers view"
        }
        onClick={() => {
          if (isTutorial) return;
          setIsCountryBuffsModalOpen(true);
        }}
      >
        <Image
          src="/gui/icons/research.png"
          alt="Open country modifiers view"
          width={24}
          height={24}
        />
      </ButtonWithTooltip>

      <ButtonWithTooltip
        disabled={editModeState.modeEnabled !== "acquire"}
        className="h-10 relative"
        tooltip={
          isTutorial
            ? "Use this to access a detailed list of all locations, and manage their buildings."
            : "Open detailed location view"
        }
        onClick={() => {
          if (isTutorial) return;
          setIsDetailedLocationViewOpen(true);
        }}
      >
        <Image
          src="/gui/icons/building.png"
          alt="Open detailed location view"
          width={24}
          height={24}
        />
      </ButtonWithTooltip>

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
        <CountryModifiersModal
          onClose={() => setIsCountryBuffsModalOpen(false)}
        ></CountryModifiersModal>
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
