import { AppContext } from "@/app/appContextProvider";
import { CountrySelectionList } from "@/app/components/countrySelectionList.component";
import { CountrySelectionMinimap } from "@/app/components/countrySelectionMinimap.component";
import { CountriesHelper } from "@/app/lib/countries.helper";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ModalInstanceContext } from "@/app/lib/modal/modal.component";
import { useContext, useMemo, useState } from "react";


export function CountrySelectionModal() {

  const { gameData } = useContext(AppContext);
  const modal = useContext(ModalInstanceContext);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  if (!modal) {
    throw new Error("[CountrySelectionModal] must be used within a Modal");
  }

  const { capitalLocation, countryLocations } = useMemo(() => {
    if (!selectedCountry) return { capitalLocation: null, countryLocations: [] };
    return {
      capitalLocation: CountriesHelper.getCountryBaseCapitalLocation(selectedCountry, gameData?.countriesDataMap ?? {}),
      countryLocations: gameData?.countriesDataMap[selectedCountry]?.locations ?? []
    };
  }, [selectedCountry, gameData?.countriesDataMap]);

  const countryHasFlag = useMemo(() => {
    return selectedCountry && gameData?.countriesDataMap[selectedCountry]?.flagUrl;
  }, [selectedCountry, gameData?.countriesDataMap]);

  return (
    <div className="flex flex-row px-2 py-1 w-[80vw] h-[75vh]">
      <CountrySelectionList
        className="w-[50%] flex-none"
        selectedCountry={selectedCountry ?? null}
        onSelect={(countryCode) => setSelectedCountry(countryCode)}
        onValidate={() => { gameStateController.reset(selectedCountry ?? undefined); modal.close(); }}
      ></CountrySelectionList>
      <div className="w-full px-2 py-1 flex flex-col">
        {capitalLocation && <CountrySelectionMinimap className="w-full bg-black px-4 py-2 justify-self-center" capitalLocation={capitalLocation} countryLocations={countryLocations}></CountrySelectionMinimap>}

        <div className="w-full h-full text-center text-lg pt-4 mt-4 mx-2 rounded-md">

          {selectedCountry ? gameData?.countriesDataMap[selectedCountry]?.name : ""}

          {selectedCountry && countryHasFlag ? (
            <img src={gameData?.countriesDataMap[selectedCountry]?.flagUrl ?? ""} alt={selectedCountry} className="block w-full justify-self-center"></img>
          ) : <span className="text-stone-500 w-full text-center justify-self-center block h-full">Could not find country flag</span>}
        </div>
      </div>
    </div>

  )

}