import { FoldableMenu } from "@/app/components/foldableMenu.component";
import {
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { AppContext } from "../appContextProvider";
import { CountryStats } from "./countryStatsComponent";
import { CountryProximityBuffs } from "@/app/components/countryBuffs/countryProximityBuffs.component";
import { CountryValuesInput } from "./countryValuesInput.component";
import { gameStateController } from "@/app/lib/gameState.controller";

export function CountryOverview() {
  const [countryMenuExpanded, setCountryMenuExpanded] = useState(false);
  const [countryStatsExpanded, setCountryStatsExpanded] = useState(false);
  const [countryProximityBuffsExpanded, setCountryProximityBuffsExpanded] = useState(false);
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const { gameData } = useContext(AppContext);

  if (!gameData) {
    return <div></div>;
  }

  const country = gameState.country;
  if (!country) {
    return <div>Loading...</div>;
  }
  return (
    <>
      <FoldableMenu
        title="Country Values"
        isExpanded={countryMenuExpanded}
        onToggle={() => setCountryMenuExpanded(!countryMenuExpanded)}
      >
        <CountryValuesInput country={country} />
      </FoldableMenu>

      <FoldableMenu
        title="Country Buff Breakdown"
        isExpanded={countryProximityBuffsExpanded}
        onToggle={() => setCountryProximityBuffsExpanded(!countryProximityBuffsExpanded)}
      >
        <CountryProximityBuffs country={country}></CountryProximityBuffs>
      </FoldableMenu>

      <FoldableMenu
        title="Country Statistics"
        isExpanded={countryStatsExpanded}
        onToggle={() => setCountryStatsExpanded(!countryStatsExpanded)}
      >
        {(Object.keys(gameState?.ownedLocations ?? []).length > 0 && (
          <CountryStats
            align={true}
            ownedLocations={gameState.ownedLocations}
          ></CountryStats>
        )) || (
            <div className="text-stone-400 text-italic">
              No owned locations - either select a country above, or create your
              own country from scratch by selecting a location
            </div>
          )}
      </FoldableMenu>
    </>
  );
}
