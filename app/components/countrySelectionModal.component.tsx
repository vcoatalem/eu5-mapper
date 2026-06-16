import { AppContext } from "@/app/appContextProvider";
import { CountrySelectionList } from "@/app/components/countrySelectionList.component";
import { CountrySelectionMinimap } from "@/app/components/countrySelectionMinimap.component";
import { CountriesHelper } from "@/app/lib/countries.helper";
import { useGameEngine } from "@/app/lib/gameEngineContext";
import { ModalInstanceContext } from "@/app/lib/modal/modal.component";
import { useContext, useEffect, useMemo, useState } from "react";
import { Loader } from "./loader.component";

export function CountrySelectionModal() {
  const { gameData } = useContext(AppContext);
  const modal = useContext(ModalInstanceContext);
  const { gameStateController, cameraController } = useGameEngine();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [loadedFlagUrl, setLoadedFlagUrl] = useState<string | null>(null);
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

  const flagUrl = useMemo(() => {
    return selectedCountry
      ? (gameData?.countriesData[selectedCountry]?.flagUrl ?? null)
      : null;
  }, [selectedCountry, gameData?.countriesData]);

  useEffect(() => {
    if (!flagUrl) return;
    const flagImg = new Image();
    flagImg.onload = () => {
      setLoadedFlagUrl(flagUrl);
    };
    flagImg.src = flagUrl;
  }, [flagUrl]);

  const flagLoaded = flagUrl !== null && loadedFlagUrl === flagUrl;

  return (
    <div className="flex flex-row py-1 w-[80vw] min-w-[860px] h-[75vh]">
      <CountrySelectionList
        className="w-[50%] flex-none"
        selectedCountry={selectedCountry ?? null}
        onSelect={(countryCode) => setSelectedCountry(countryCode)}
        onValidate={() => {
          gameStateController.reset(selectedCountry ?? undefined);
          if (gameData && capitalLocation) {
            cameraController.panToLocation(gameData, capitalLocation);
          }
          modal.close();
        }}
      ></CountrySelectionList>
      <div
        className="w-full py-1 flex flex-col h-full items-center max-w-100 mt-4 mx-auto overflow-y-scroll overflow-x-hidden overscroll-none"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="w-[50%] mx-auto aspect-3/2 flex items-center justify-center text-stone-500">
          {selectedCountry && flagUrl ? (
            flagLoaded ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={flagUrl}
                alt={selectedCountry}
                className="block w-full h-full object-contain"
              ></img>
            ) : (
              <Loader size={50}></Loader>
            )
          ) : (
            <span className="text-stone-500 w-full text-center block">
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
