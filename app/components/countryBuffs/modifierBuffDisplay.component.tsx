import { countryBuffsMetadata } from "@/app/lib/classes/countryProximityBuffs.const";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { BuffsHelper } from "@/app/lib/buffs.helper";
import { IBuffValue, ICountryProximityBuffs } from "@/app/lib/types/proximityComputationRules";
import { useRef } from "react";

export function ModifierBuffDisplay({
  buffKey,
  buffValue,
}: {
  buffKey: keyof ICountryProximityBuffs;
  buffValue: Record<string, IBuffValue>;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const buffDisplayableData = countryBuffsMetadata[buffKey];
  const sum = BuffsHelper.sumBuffs(Object.values(buffValue));
  const isPercent = buffDisplayableData.valueDefinition.type === "percentage";
  const suffix = isPercent ? "%" : "";
  return (
    <div key={buffKey} ref={divRef} className="flex flex-row items-center gap-1 relative">
      <Tooltip config={{ offset: { x: 100, y: 0 }, preferredHorizontal: "right", preferredVertical: "bottom" }}>
        <TooltipTrigger>
          <p className="flex flex-row w-full items-center gap-1 hover:bg-stone-700/50 rounded-md p-1 cursor-help">
            <b><span className="flex-none w-32">{buffDisplayableData.label}</span></b>
            <span className="ml-auto">{sum.toFixed(2)}{suffix}</span>
          </p>
        </TooltipTrigger>
        <TooltipContent anchor={{ type: "dom", ref: divRef as React.RefObject<HTMLElement> }}>
          <div className="flex flex-col gap-1 bg-black max-w-96">
            <span><b>{buffDisplayableData.label}</b>:</span>
            <span dangerouslySetInnerHTML={{ __html: buffDisplayableData.valueDefinition.description }} />
            <span>Current value: {sum.toFixed(2)}{suffix}</span>
            <hr className="w-full border-stone-600 my-1" />
            <span><b>Modifiers Breakdown:</b></span>
            {Object.entries(buffValue)
              .filter(([, v]) => v.value !== 0)
              .map(([name, v]) => (
                <span key={name}>{name}: {v.value.toFixed(2)}{suffix}</span>
              ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}