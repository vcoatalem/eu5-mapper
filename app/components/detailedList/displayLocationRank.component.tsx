import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { LocationsHelper } from "@/app/lib/locations.helper";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import styles from "@/app/styles/button.module.css";
import { useRef } from "react";

export function DisplayRank(props: { data: ILocationDetailedViewData }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  return (
    <span ref={spanRef}>
      <Tooltip config={{ openDelay: 2000, closeDelay: 0, offset: { x: 20, y: 0 } }}>
        <TooltipTrigger>
          <select
            id={props.data.baseLocationGameData.name + "-rank"}
            className={"w-content h-full outline-none " + styles.simpleButton}
            onChange={({ target }) => {
              gameStateController.changeLocationRank(
                props.data.baseLocationGameData.name,
                LocationsHelper.getLocationRank(target.value),
              );
            }}
            value={props.data.constructibleData.rank}
            style={{ outline: "none", border: "none", appearance: "none" }}
          >
            {["rural", "town", "city"].map((rank) => (
              <option style={{ outline: "none" }} key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>
        </TooltipTrigger>
        <TooltipContent anchor={{ type: "dom", ref: spanRef }}>
          <span>Change the rank of the location</span>
        </TooltipContent>
      </Tooltip>
    </span>


  );
}