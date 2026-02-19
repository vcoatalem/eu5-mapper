import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { IDetailedLocationListProps } from "@/app/components/detailedList/detailedList.config";
import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { useMemo } from "react";
import { IoStarSharp } from "react-icons/io5";
import { TiPinOutline } from "react-icons/ti";

export function DisplayLocation(props: {
  data: ILocationDetailedViewData;
  extensiveViewProps: IDetailedLocationListProps;
}) {
  const isCapital = useMemo(
    () =>
      props.extensiveViewProps?.capitalLocation ===
      props.data.baseLocationGameData.name,
    [
      props.extensiveViewProps?.capitalLocation,
      props.data.baseLocationGameData.name,
    ],
  );
  const isPinned = props.data.pinned ?? false;
  const capitalBtn = (
    <ButtonWithTooltip
      key={"capital-btn-" + props.data.baseLocationGameData.name}
      isActive={isCapital}
      tooltip={
        isCapital ? (
          <span>This is your capital</span>
        ) : (
          <span>Change capital</span>
        )
      }
      onClick={() =>
        !isCapital
          ? gameStateController.changeCapital(
            props.data.baseLocationGameData.name,
          )
          : null
      }
      showOnHover={true}
      className="ml-auto"
    >
      <IoStarSharp color="white" size={16}></IoStarSharp>
    </ButtonWithTooltip>
  );
  const pinBtn = (
    <ButtonWithTooltip
      key={"pin-btn-" + props.data.baseLocationGameData.name}
      isActive={isPinned}
      tooltip={
        isPinned ? <span>Unpin location</span> : <span>Pin location</span>
      }
      showOnHover={true}
      className="ml-auto"
      onClick={(e) => {
        e?.stopPropagation();
        props.extensiveViewProps.togglePin(props.data.baseLocationGameData.name);
      }}
    >
      <TiPinOutline color="white" size={16}></TiPinOutline>
    </ButtonWithTooltip>
  );
  const buttons = [capitalBtn, pinBtn];
  const activeButtons = buttons.filter((btn, idx) =>
    idx === 0 ? isCapital : isPinned,
  );
  const inactiveButtons = buttons.filter(
    (btn, idx) => !(idx === 0 ? isCapital : isPinned),
  );
  return (
    <div className="group w-full h-full flex flex-row items-center px-1 relative">
      <span className="px-1 py-1 flex-none">
        {StringHelper.formatLocationName(props.data.baseLocationGameData.name)}
      </span>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-row-reverse gap-1">
        {activeButtons}
        {inactiveButtons}
      </div>
    </div>
  );
}
