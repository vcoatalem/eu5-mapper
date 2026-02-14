import { useRef, useState, useSyncExternalStore } from "react";
import { roadBuilderController } from "@/app/lib/roadBuilderController";
import { Tooltip } from "../lib/tooltip/tooltip.component";
import { TooltipTrigger } from "../lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "../lib/tooltip/tooltipContent.component";
import Image from "next/image";
import { changeCapitalController } from "@/app/lib/changeCapital.controller";
import { Modal } from "../lib/modal/modal.component";
import { DetailedLocationListModal } from "./detailedList/detailedLocationListModal.component";
import { IoStarSharp } from "react-icons/io5";
import { TbListDetails } from "react-icons/tb";

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

  const [isDetailedLocationViewOpen, setIsDetailedLocationViewOpen] =
    useState(false);

  return (
    <div className="flex flex-row gap-2">
      <button
        ref={changeCapitalButtonRef}
        onClick={() => changeCapitalController.toggleChangeCapitalMode()}
        disabled={roadBuildingState.isBuildingModeEnabled}
        className={
          "w-10 h-10 rounded-md border border-white flex items-center justify-center cursor-pointer hover:bg-stone-600 " +
          (changeCapitalState.isModeEnabled
            ? " hover:bg-yellow-500 bg-yellow-400 "
            : "") +
          (roadBuildingState.isBuildingModeEnabled
            ? " cursor-not-allowed opacity-50 "
            : "")
        }
      >
        <Tooltip>
          <TooltipTrigger>
            <IoStarSharp color="white" size={24}></IoStarSharp>
          </TooltipTrigger>
          <TooltipContent
            anchor={{
              type: "dom",
              ref: changeCapitalButtonRef as React.RefObject<HTMLElement>,
            }}
          >
            <span className="">Change capital</span>
          </TooltipContent>
        </Tooltip>
      </button>

      <button
        ref={buildRoadButtonRef}
        disabled={changeCapitalState.isModeEnabled}
        className={
          "w-10 h-10 rounded-md border border-white flex items-center justify-center cursor-pointer hover:bg-stone-600 " +
          (roadBuildingState.isBuildingModeEnabled
            ? " hover:bg-yellow-500 bg-yellow-400 "
            : "") +
          (changeCapitalState.isModeEnabled
            ? " cursor-not-allowed opacity-50 "
            : "")
        }
        onClick={() => roadBuilderController.toggleBuildingMode()}
      >
        <Tooltip>
          <TooltipTrigger>
            <Image
              src="/gui/icons/gravel_road.png"
              alt="Enter build road mode"
              width={32}
              height={32}
            ></Image>
          </TooltipTrigger>
          <TooltipContent
            anchor={{
              type: "dom",
              ref: buildRoadButtonRef as React.RefObject<HTMLElement>,
            }}
          >
            Build roads
          </TooltipContent>
        </Tooltip>
      </button>

      <button
        ref={openDetailedViewButtonRef}
        className="w-10 h-10 p-2 rounded-md border border-white flex items-center justify-center cursor-pointer hover:bg-stone-600"
        onClick={() => setIsDetailedLocationViewOpen(true)}
      >
        <Tooltip>
          <TooltipTrigger>
            <TbListDetails color="white" size={32}></TbListDetails>
          </TooltipTrigger>
          <TooltipContent
            anchor={{
              type: "dom",
              ref: openDetailedViewButtonRef as React.RefObject<HTMLElement>,
            }}
          >
            Open detailed location view
          </TooltipContent>
        </Tooltip>
      </button>

      <Modal
        onClose={() => setIsDetailedLocationViewOpen(false)}
        isOpen={isDetailedLocationViewOpen}
      >
        <DetailedLocationListModal></DetailedLocationListModal>
      </Modal>
    </div>
  );
}
