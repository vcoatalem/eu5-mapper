import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { IProximityBuffDisplayableData, IProximityBuffs } from "@/app/lib/types/proximityComputationRules";
import { useRef } from "react";

export function BuffDisplay({ buffKey, buffValue, buffDisplayableData }: { buffKey: keyof IProximityBuffs, buffValue: { buffRecord: Record<string, number>; sum: number }, buffDisplayableData: IProximityBuffDisplayableData }) {
  const divRef = useRef<HTMLDivElement>(null);
  return (
    <div key={buffKey} ref={divRef} className="flex flex-row items-center gap-1 relative">
      <Tooltip config={{ offset: { x: 100, y: 0 }, preferredHorizontal: "right", preferredVertical: "bottom"}}>
        <TooltipTrigger>
          <p className="flex flex-row w-full items-center gap-1 hover:bg-stone-700/50 rounded-md p-1 cursor-help">
            <b><span className="flex-none w-32">{buffDisplayableData.label}</span></b>
            <span className="ml-auto">{buffValue.sum.toFixed(2)}{buffDisplayableData.description.includes("%") ? "%" : ""}</span>
          </p>
        </TooltipTrigger>
        <TooltipContent anchor={{ type: "dom", ref: divRef as React.RefObject<HTMLElement> }}>
          <div className="flex flex-col gap-1 bg-black max-w-96">
            <span><b>{buffDisplayableData.label}</b>:</span>
            <span dangerouslySetInnerHTML={{ __html: buffDisplayableData.description }}/>
            <span>Current value:  { buffValue.sum.toFixed(2)}{buffDisplayableData.description.includes("%") ? "%" : ""}</span>
            <hr className="w-full border-stone-600 my-1"></hr>
            <span><b>Modifiers Breakdown:</b></span>
            {Object.entries(buffValue.buffRecord).filter(([,buffValue]) => buffValue !== 0).map(([buffName, buffValue]) => {
              return <span key={buffName}>{buffName}: {buffValue.toFixed(2)}{buffDisplayableData.description.includes("%") ? "%" : ""}</span>
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}