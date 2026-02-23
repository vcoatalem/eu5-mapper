import { AppContext } from "@/app/appContextProvider";
import { ModifierBuffDisplay } from "@/app/components/countryBuffs/modifierBuffDisplay.component";
import { ProximityBuffsRecord } from "@/app/lib/classes/countryProximityBuffs";
import { IGameState } from "@/app/lib/types/general";
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
        {Array.from(buffRecord.getBuffsToDisplay()).map((buffKey) => (
          <ModifierBuffDisplay key={buffKey} buffKey={buffKey} buffValue={buffRecord.getBuffsOfType(buffKey)} />
        ))}
      </div>
    </div>
  );
}