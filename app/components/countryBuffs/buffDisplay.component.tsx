import { countryProximityBuffsDisplayableData } from "@/app/lib/classes/countryProximityBuffs.const";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { IProximityBuffs } from "@/app/lib/types/proximityComputationRules";
import { useRef } from "react";

interface IBuffDisplayProps {
  buffKey: keyof IProximityBuffs;
  buffValue: number;
  className?: string;
}

export function BuffDisplay({ buffKey, buffValue, className }: IBuffDisplayProps) {
  const divRef = useRef<HTMLDivElement>(null);
  return (
    <div key={buffKey} ref={divRef} className={["relative flex flex-row items-center gap-1", className].join(" ")}>
      <Tooltip config={{ offset: { x: 100, y: 0 }, preferredHorizontal: "left", preferredVertical: "bottom" }}>
        <TooltipTrigger>
          <span className="flex-none flex-1 rounded-md p-1 cursor-help">{countryProximityBuffsDisplayableData[buffKey].label}</span>
        </TooltipTrigger>
        <TooltipContent anchor={{ type: "dom", ref: divRef as React.RefObject<HTMLElement> }}>
          <div className="max-w-96">
            <span dangerouslySetInnerHTML={{ __html: countryProximityBuffsDisplayableData[buffKey].description }} />
          </div>
        </TooltipContent>
      </Tooltip>
      <span className="ml-auto">{buffValue.toFixed(2)}{countryProximityBuffsDisplayableData[buffKey].description.includes("%") ? "%" : ""}</span>
    </div>)

}