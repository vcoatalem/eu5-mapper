import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { RoadBuilderController, roadBuilderController } from "@/app/lib/roadBuilderController";
import { Tooltip } from "../lib/tooltip/tooltip.component";
import { TooltipTrigger } from "../lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "../lib/tooltip/tooltipContent.component";
import Image from "next/image";
import { ChangeCapitalController, changeCapitalController } from "@/app/lib/changeCapital.controller";
import { Modal } from "../lib/modal/modal.component";
import { DetailedLocationListModal } from "./detailedList/detailedLocationListModal.component";
import { IoStarSharp } from "react-icons/io5";
import { TbListDetails } from "react-icons/tb";
import { MaritimePresenceEditController, maritimePresenceEditController } from "@/app/lib/maritimePresenceEditController";
import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { MdAnchor } from "react-icons/md";

export function MainActionsBar() {
  const buildRoadButtonRef = useRef<HTMLButtonElement>(null);
  const changeCapitalButtonRef = useRef<HTMLButtonElement>(null);
  const openDetailedViewButtonRef = useRef<HTMLButtonElement>(null);

  const roadBuildingState = useSyncExternalStore(
    roadBuilderController.subscribe.bind(roadBuilderController),
    () => roadBuilderController.getSnapshot(),
  );

  const changeCapitalState = useSyncExternalStore(
    changeCapitalController.subscribe.bind(changeCapitalController),
    () => changeCapitalController.getSnapshot(),
  );

  const maritimePresenceEditState = useSyncExternalStore(
    maritimePresenceEditController.subscribe.bind(maritimePresenceEditController),
    () => maritimePresenceEditController.getSnapshot(),
  );

  const [isDetailedLocationViewOpen, setIsDetailedLocationViewOpen] =
    useState(false);

  const toggleMode = useCallback((controller: ChangeCapitalController | RoadBuilderController | MaritimePresenceEditController) => {

    const { currentController, otherControllers} = {
      currentController: controller,
      otherControllers: [changeCapitalController, roadBuilderController, maritimePresenceEditController].filter(c => c !== controller),
    }

    for (const controller of otherControllers) {
      if (controller.getSnapshot().isModeEnabled) {
        controller.toggleMode();
      }
    }
    currentController.toggleMode();
  }, []);

  return (
    <div className="flex flex-row gap-2 items-center">

      <ButtonWithTooltip className="h-10 relative" tooltip="Toggle capital location edition" isActive={changeCapitalState.isModeEnabled} onClick={() => toggleMode(changeCapitalController)}>
        <IoStarSharp color="white" size={24}></IoStarSharp>
      </ButtonWithTooltip>

      <ButtonWithTooltip className="h-10 relative" tooltip="Toggle road building edition" isActive={roadBuildingState.isModeEnabled} onClick={() => toggleMode(roadBuilderController)}>
        <Image
          src="/gui/icons/gravel_road.png"
          alt="Enter build road mode"
          width={24}
          height={24}
          style={{ filter: 'grayscale(100%)' }}
        ></Image>
      </ButtonWithTooltip>

      <ButtonWithTooltip className="h-10 relative" tooltip="Toggle maritime presence edition" isActive={maritimePresenceEditState.isModeEnabled} onClick={() => toggleMode(maritimePresenceEditController)}>
        <MdAnchor color="white" size={24}></MdAnchor>
      </ButtonWithTooltip>

      <ButtonWithTooltip className="h-10 relative" tooltip="Open detailed location view" onClick={() => setIsDetailedLocationViewOpen(true)}>
        <TbListDetails color="white" size={24}></TbListDetails>
      </ButtonWithTooltip>

      <Modal
        onClose={() => setIsDetailedLocationViewOpen(false)}
        isOpen={isDetailedLocationViewOpen}
      >
        <DetailedLocationListModal></DetailedLocationListModal>
      </Modal>
    </div>
  );
}
