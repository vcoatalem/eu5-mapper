// note: it might be interesting to make it so countries file is fetched here, in order to remove some of the initial load

import { useCallback, useContext, useMemo } from "react";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "@/app/lib/gameState.controller";

// especially if in the future we add more and more data to the countries
export function CountrySelectionList() {
  const { gameData } = useContext(AppContext);

  if (!gameData) return <></>;

  const filteredCountries = useMemo(() => {
    const countries = Object.entries(gameData.countriesDataMap);
    return countries.filter(([, data]) => data.locations.length > 0);
  }, [gameData.countriesDataMap]);

  const chooseCountry = useCallback((countryCode: string) => {
    gameStateController.reset(countryCode);
  }, []);

  return (
    <div className="h-64 overflow-y-scroll flex flex-col gap-1">
      {filteredCountries.map(([countryKey, countryData]) => (
        <div
          key={countryKey}
          className="px-2 py-1 hover:bg-stone-700 cursor-pointer rounded-md"
          onClick={() => chooseCountry(countryKey)}
        >
          {countryData.name} ({countryKey})
        </div>
      ))}
    </div>
  );
}
