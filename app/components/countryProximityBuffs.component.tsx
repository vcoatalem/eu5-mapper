import { AppContext } from "@/app/appContextProvider";
import { ProximityBuffsRecord } from "@/app/lib/classes/countryProximityBuffs";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { IGameState } from "@/app/lib/types/general";
import { IProximityBuffDisplayableData, IProximityBuffs } from "@/app/lib/types/proximityComputationRules";
import { useContext, useEffect, useRef, useState } from "react";

interface ICountryProximityBuffsProps {
  className?: string;
  country: IGameState["country"];
}

function BuffDisplay({ buffKey, buffValue, buffDisplayableData }: { buffKey: keyof IProximityBuffs, buffValue: { buffRecord: Record<string, number>; sum: number }, buffDisplayableData: IProximityBuffDisplayableData }) {
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

export function CountryProximityBuffs(props: ICountryProximityBuffsProps) {

  const gameData = useContext(AppContext).gameData;
  const [buffRecord, setBuffRecord] = useState<ProximityBuffsRecord | null>(null);

  const countrySignature = JSON.stringify(props.country)
  useEffect(() => {
    if (!gameData || !props.country) {
      return;
    }
    const buffRecord = new ProximityBuffsRecord(gameData.proximityComputationRule, props.country);
    queueMicrotask(() => setBuffRecord(buffRecord));
  }, [gameData, countrySignature]);

  if (!gameData || !buffRecord) {
    return <div>Loading...</div>;
  }

  return (
    <div className={[props.className].join(" ")}>
      <div className="flex flex-col gap-1">
        {Object.entries(buffRecord.getBuffsToDisplay()).map(([buffKeyString, buffDisplayableData]) => {
            const buffKey = buffKeyString as keyof IProximityBuffs;
            return <BuffDisplay key={buffKey} buffKey={buffKey} buffValue={buffRecord.getBuffsOfType(buffKey)} buffDisplayableData={buffDisplayableData} />
          }
        )}
      </div>
    </div>
  );
}