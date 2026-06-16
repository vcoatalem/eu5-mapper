import { DisplayCountryProximityBuffs } from "@/app/components/countryBuffs/countryProximityBuffs.component";
import { FoldableMenu } from "@/app/components/foldableMenu.component";
import { useContext, useState } from "react";
import { AppContext } from "../appContextProvider";
import { CountryValuesInput } from "./countryValuesInput.component";
import { useModel } from "@/app/lib/gameEngineContext";

export function CountryOverview() {
  const [countryMenuExpanded, setCountryMenuExpanded] = useState(false);
  const [countryProximityBuffsExpanded, setCountryProximityBuffsExpanded] =
    useState(false);
  const gameState = useModel("gameStateController");

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
        title="Country Modifiers Breakdown"
        isExpanded={countryProximityBuffsExpanded}
        onToggle={() =>
          setCountryProximityBuffsExpanded(!countryProximityBuffsExpanded)
        }
      >
        <DisplayCountryProximityBuffs
          className="pl-2"
          country={country}
        ></DisplayCountryProximityBuffs>
      </FoldableMenu>
    </>
  );
}
