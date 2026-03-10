import { useContext, useMemo, useState } from "react";
import { AppContext } from "../appContextProvider";
import { CountriesHelper } from "@/app/lib/countries.helper";
import { ArrayHelper } from "@/app/lib/array.helper";

interface ICountrySelectionListProps {
  selectedCountry: string | null;
  onSelect: (countryCode: string) => unknown;
  onValidate: () => void;
  className?: string;
}

// note: it might be interesting to make it so countries file is fetched here, in order to remove some of the initial load
// especially if in the future we add more and more data to the countries
export function CountrySelectionList(props: ICountrySelectionListProps) {
  const { gameData } = useContext(AppContext);
  const [search, setSearch] = useState<string>("");
  const filteredCountries = useMemo(() => {
    const countries = Object.entries(gameData?.countriesData ?? {});
    const countriesArray = countries
      .filter(([, data]) => data.locations.length > 0)
      .map(([countryKey, countryData]) => {
        const capitalLocation = CountriesHelper.getCountryBaseCapitalLocation(
          countryKey,
          gameData?.countriesData ?? {},
        );
        return {
          countryKey,
          countryData: {
            ...countryData,
            capitalHierarchy: gameData?.locationDataMap[capitalLocation]
              ?.hierarchy ?? {
              continent: "",
              subcontinent: "",
              region: "",
              area: "",
              province: "",
            },
          },
        };
      });
    return ArrayHelper.reduceToRecord(
      countriesArray,
      (country) => country.countryKey,
      (country) => country.countryData,
    );
  }, [gameData?.countriesData, gameData?.locationDataMap]);

  const searchedCountries = useMemo(() => {
    return Object.entries(filteredCountries).filter(
      ([countryKey, countryData]) => {
        return (
          countryData.name.toLowerCase().includes(search.toLowerCase()) ||
          countryKey.toLowerCase().includes(search.toLowerCase())
        );
      },
    );
  }, [filteredCountries, search]);

  if (!gameData) return <></>;

  return (
    <div
      className={
        "flex flex-col gap-1 min-w-0 overflow-x-hidden " + props.className
      }
    >
      <input
        type="text"
        autoFocus={true}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search for a country or tag"
        className="py-1 px-2 min-w-0"
        style={{ outline: "none" }}
      />
      <hr className="w-full"></hr>
      <div className="h-full overflow-y-scroll overflow-x-hidden min-w-0">
        {searchedCountries.map(([countryKey, countryData]) => (
          <div
            key={countryKey}
            className={
              "px-2 py-1 hover:bg-stone-700 cursor-pointer rounded-md flex flex-row items-center gap-2 min-w-0 mr-4 " +
              (props.selectedCountry === countryKey ? "bg-stone-700" : "")
            }
            onClick={() => props.onSelect(countryKey)}
          >
            <span className="min-w-0 truncate">{countryData.name}</span>
            <span className="text-stone-500 text-sm flex-none">
              ({countryKey})
            </span>
            <span className="text-stone-500 text-sm ml-auto flex-none shrink-0">
              {countryData.capitalHierarchy.subcontinent ??
                countryData.capitalHierarchy.region ??
                countryData.capitalHierarchy.area ??
                countryData.capitalHierarchy.province ??
                ""}
            </span>
          </div>
        ))}
      </div>

      {props.selectedCountry && (
        <button
          onClick={props.onValidate}
          className="bg-stone-700 hover:bg-stone-800 cursor-pointer rounded-md px-2 py-1 bottom-0 left-0 right-0"
        >
          Choose{" "}
          {gameData.countriesData[props.selectedCountry]?.name ??
            props.selectedCountry}
        </button>
      )}
    </div>
  );
}
