import { AppContext } from "@/app/appContextProvider";
import { CountrySelectionList } from "@/app/components/countrySelectionList.component";
import { CountrySelectionMinimap } from "@/app/components/countrySelectionMinimap.component";
import { CountriesHelper } from "@/app/lib/countries.helper";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ModalInstanceContext } from "@/app/lib/modal/modal.component";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "./loader.component";

export function CountrySelectionModal() {
  const { gameData } = useContext(AppContext);
  const modal = useContext(ModalInstanceContext);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const flagImgRef = useRef<HTMLImageElement | null>(null);
  const [flagLoaded, setFlagLoaded] = useState<boolean>(false);
  if (!modal) {
    throw new Error("[CountrySelectionModal] must be used within a Modal");
  }

  const { capitalLocation, countryLocations } = useMemo(() => {
    if (!selectedCountry)
      return { capitalLocation: null, countryLocations: [] };
    return {
      capitalLocation: CountriesHelper.getCountryBaseCapitalLocation(
        selectedCountry,
        gameData?.countriesDataMap ?? {},
      ),
      countryLocations:
        gameData?.countriesDataMap[selectedCountry]?.locations ?? [],
    };
  }, [selectedCountry, gameData?.countriesDataMap]);

  const countryHasFlag = useMemo(() => {
    return (
      selectedCountry && gameData?.countriesDataMap[selectedCountry]?.flagUrl
    );
  }, [selectedCountry, gameData?.countriesDataMap]);

  useEffect(() => { 
    setFlagLoaded(false);
    const flagImg = new Image();
    flagImg.onload = () => {
      setFlagLoaded(true);
    };
    flagImgRef.current = flagImg;
    flagImg.src =
      gameData?.countriesDataMap[selectedCountry ?? ""]?.flagUrl ?? "";
  }, [selectedCountry]);

  return (
    <div className="flex flex-row py-1 w-[80vw] min-w-[860px] h-[75vh]">
      <CountrySelectionList
        className="w-[50%] flex-none"
        selectedCountry={selectedCountry ?? null}
        onSelect={(countryCode) => setSelectedCountry(countryCode)}
        onValidate={() => {
          gameStateController.reset(selectedCountry ?? undefined);
          modal.close();
        }}
      ></CountrySelectionList>
      <div className="w-full py-1 flex flex-col h-full items-center max-w-[400px] ml-auto mr-8 mt-4">
        <div className="w-full text-center text-lg font-bold rounded-md">
          {selectedCountry
            ? gameData?.countriesDataMap[selectedCountry]?.name
            : ""}
        </div>

        <div className="w-full flex flex-center items-center text-stone-500">
          {selectedCountry && countryHasFlag ? (
            flagLoaded ? (
              <img
                src={flagImgRef.current?.src}
                alt={selectedCountry}
                className="block w-full justify-self-center"
              ></img>
            ) : (
              <Loader size={50}></Loader>
            )
          ) : (
            <span className="text-stone-500 w-full text-center justify-self-center block h-full">
              Could not find country flag
            </span>
          )}
        </div>

        {capitalLocation && (
          <CountrySelectionMinimap
            className="w-full bg-black py-2 justify-self-center mx-auto"
            capitalLocation={capitalLocation}
            countryLocations={countryLocations}
          ></CountrySelectionMinimap>
        )}
      </div>
    </div>
  );
}
