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
        gameData?.countriesData ?? {},
      ),
      countryLocations:
        gameData?.countriesData[selectedCountry]?.locations ?? [],
    };
  }, [selectedCountry, gameData?.countriesData]);

  const countryHasFlag = useMemo(() => {
    return selectedCountry && gameData?.countriesData[selectedCountry]?.flagUrl;
  }, [selectedCountry, gameData?.countriesData]);

  useEffect(() => {
    setFlagLoaded(false);
    const flagImg = new Image();
    flagImg.onload = () => {
      setFlagLoaded(true);
    };
    flagImgRef.current = flagImg;
    flagImg.src = gameData?.countriesData[selectedCountry ?? ""]?.flagUrl ?? "";
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
      <div
        className="w-full py-1 flex flex-col h-full items-center max-w-[400px] mt-4 mx-auto overflow-y-scroll overflow-x-hidden overscroll-none"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="w-[50%] mx-auto flex flex-center items-center text-stone-500 block">
          {selectedCountry && countryHasFlag ? (
            flagLoaded ? (
              <img
                src={flagImgRef.current?.src}
                alt={selectedCountry}
                className="block w-full justify-self-center"
              ></img>
            ) : (
              <Loader className="mx-auto" size={50}></Loader>
            )
          ) : (
            <span className="text-stone-500 w-full text-center justify-self-center block h-full">
              Could not find country flag
            </span>
          )}
        </div>

        {capitalLocation && (
          <>
            <CountrySelectionMinimap
              className="w-full bg-black py-2 justify-self-center mx-auto"
              capitalLocation={capitalLocation}
              countryLocations={countryLocations}
              viewW={3600}
              viewH={1800}
            ></CountrySelectionMinimap>
            <CountrySelectionMinimap
              className="w-full bg-black py-2 justify-self-center mx-auto"
              capitalLocation={capitalLocation}
              countryLocations={countryLocations}
              viewW={1200}
              viewH={600}
            ></CountrySelectionMinimap>
          </>
        )}
      </div>
    </div>
  );
}
