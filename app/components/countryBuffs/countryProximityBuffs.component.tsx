import { AppContext } from "@/app/appContextProvider";
import { BuffDisplay } from "@/app/components/countryBuffs/buffDisplay.component";
import { ProximityBuffsRecord } from "@/app/lib/classes/countryProximityBuffs";
import { IGameState } from "@/app/lib/types/general";
import { IProximityBuffs } from "@/app/lib/types/proximityComputationRules";
import { useContext, useEffect, useState } from "react";

interface ICountryProximityBuffsProps {
  className?: string;
  country: IGameState["country"];
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