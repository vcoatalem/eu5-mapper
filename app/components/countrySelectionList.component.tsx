// note: it might be interesting to make it so countries file is fetched here, in order to remove some of the initial load

import { useCallback, useContext, useMemo, useState } from "react";
import { AppContext } from "../appContextProvider";
import { useModal } from "@/app/lib/modal/modal.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ICountryData, ILocationGameData, ILocationIdentifier } from "@/app/lib/types/general";
import { CountriesHelper } from "@/app/lib/countries.helper";

// especially if in the future we add more and more data to the countries
export function CountrySelectionList() {
  const { gameData } = useContext(AppContext);
  const { close: closeModal } = useModal();
  const [selectedCountry, setSelectedCountry] = useState<ILocationIdentifier | null>(null);
  const [search, setSearch] = useState<string>("");
  const filteredCountries: Record<ILocationIdentifier, ICountryData & { capitalHierarchy: ILocationGameData["hierarchy"] }> = useMemo(() => {
    const countries = Object.entries(gameData?.countriesDataMap ?? {});
    return countries
      .filter(([, data]) => data.locations.length > 0)
      .map(([countryKey, countryData]) => {
        const capitalLocation = CountriesHelper.getCountryBaseCapitalLocation(countryKey, gameData?.countriesDataMap ?? {});
        return {
          countryKey, countryData: {
            ...countryData,
            capitalHierarchy: gameData?.locationDataMap[capitalLocation]?.hierarchy ?? { continent: "", subcontinent: "", region: "", area: "", province: "" },
          }
        };
      })
      .reduce((acc, { countryKey, countryData }) => {
        acc[countryKey] = countryData;
        return acc;
      }, {} as Record<ILocationIdentifier, ICountryData & { capitalHierarchy: ILocationGameData["hierarchy"] }>);
  }, [gameData?.countriesDataMap, gameData?.locationDataMap]);

  const searchedCountries = useMemo(() => {
    return Object.entries(filteredCountries).filter(([countryKey, countryData]) => {
      return countryData.name.toLowerCase().includes(search.toLowerCase()) || countryKey.toLowerCase().includes(search.toLowerCase());
    });
  }, [filteredCountries, search]);

  const select = useCallback((countryCode: string) => {
    setSelectedCountry(countryCode);
  }, []);


  const submit = useCallback(() => {
    if (!selectedCountry) return;
    gameStateController.reset(selectedCountry);
    if (closeModal) {
      closeModal();
    }
  }, [selectedCountry, closeModal]);

  if (!gameData) return <></>;

  return (
    <div className="w-[70vh] h-[50vh] flex flex-col gap-1 min-w-0 overflow-x-hidden">
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for a country or tag" className="py-1 px-2 min-w-0" style={{ outline: "none" }} />
      <hr className="w-full"></hr>
      <div className="h-full overflow-y-scroll overflow-x-hidden min-w-0">
        {searchedCountries.map(([countryKey, countryData]) => (
          <div
            key={countryKey}
            className={"px-2 py-1 hover:bg-stone-700 cursor-pointer rounded-md flex flex-row items-center gap-2 min-w-0 mr-4 " + (selectedCountry === countryKey ? "bg-stone-700" : "")}
            onClick={() => select(countryKey)}
          >
            <span className="min-w-0 truncate">{countryData.name}</span>
            <span className="text-stone-500 text-sm flex-none">({countryKey})</span>
            <span className="text-stone-500 text-sm ml-auto flex-none shrink-0">{countryData.capitalHierarchy.subcontinent ?? countryData.capitalHierarchy.region ?? countryData.capitalHierarchy.area ?? countryData.capitalHierarchy.province ?? ""}</span>
          </div>
        ))}
      </div>

      {selectedCountry && <button onClick={submit} className="bg-stone-700 hover:bg-stone-800 cursor-pointer rounded-md px-2 py-1 bottom-0 left-0 right-0">Choose {gameData.countriesDataMap[selectedCountry]?.name ?? selectedCountry}</button>}
    </div>
  );
}
