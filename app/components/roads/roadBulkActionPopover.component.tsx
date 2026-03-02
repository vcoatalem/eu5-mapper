import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { Popover } from "@/app/lib/popover/popover.component";
import { allRoadTypes, RoadType } from "@/app/lib/types/roads";
import buttonStyles from "@/app/styles/button.module.css";
import { RoadsHelper } from "@/app/lib/roads.helper";
import { useContext, useMemo, useSyncExternalStore } from "react";
import { gameStateController } from "@/app/lib/gameState.controller";
import { AppContext } from "@/app/appContextProvider";
import Image from "next/image";
import { getRoadIcon } from "@/app/lib/drawing/getImages";
import { IoIosHammer } from "react-icons/io";
import { ArrayHelper } from "@/app/lib/array.helper";

interface IRoadBulkActionPopoverProps {}

export function RoadBulkActionPopover({}: IRoadBulkActionPopoverProps) {
  const gameData = useContext(AppContext).gameData;

  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const baseRoads = gameData?.roads ?? {};
  const stateRoads = gameState?.roads ?? {};

  const areAllRoadsOfType: Record<RoadType, boolean> = useMemo(() => {
    return ArrayHelper.reduceToRecord(
      allRoadTypes,
      (type) => type,
      (type) =>
        RoadsHelper.areAllOwnedRoadsOfType(
          gameState.ownedLocations,
          baseRoads,
          stateRoads,
          type,
        ),
    );
  }, [gameState.ownedLocations, baseRoads, stateRoads]);

  return (
    <Popover
      placement="right"
      panelClassName="w-64"
      renderTrigger={({ isOpen, toggle }) => (
        <ButtonWithTooltip
          isActive={isOpen}
          onClick={toggle}
          tooltip="Bulk actions for roads"
        >
          <IoIosHammer color="white" size={24}></IoIosHammer>
        </ButtonWithTooltip>
      )}
    >
      <div className="rounded-md bg-blue-500/20 border border-stone-600 px-2 py-1 items-center flex flex-row gap-4">
        <p className="text-sm">Bulk update road type</p>
        <div className="flex flex-col shrink-0 items-center w-fit flex-wrap gap-1 max-h-24">
          {allRoadTypes.map((type) => (
            <button
              key={type}
              className={`${buttonStyles.iconButton} ${areAllRoadsOfType[type] ? buttonStyles.buttonActive : ""}`}
              onClick={() =>
                gameStateController.changeAllOwnedRoadsToType(type)
              }
            >
              <Image
                src={getRoadIcon(type)}
                alt={`bulk update to type ${type}`}
                width={24}
                height={24}
              ></Image>
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}
