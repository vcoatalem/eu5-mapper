import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { ModalInstanceContext } from "@/app/lib/modal/modal.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { AppContext } from "../../appContextProvider";
import { CountryStats } from "../countryStatsComponent";
import {
  IConstructibleLocation,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
  ITemporaryLocationData,
} from "../../lib/types/general";
import { DetailedLocationList } from "./detailedLocationList.component";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { proximityComputationController } from "@/app/lib/proximityComputation.controller";
import { NewConstructibleState } from "@/app/lib/types/building";
import { IoSearch } from "react-icons/io5";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";
import { EligibleBuildingService } from "@/app/lib/eligibleBuilding.service";
import { HiOutlineCog6Tooth } from "react-icons/hi2";
import styles from "@/app/styles/button.module.css";
import { columns, IStoredLocationListConfig, loadConfigFromLocalStorage, saveConfigToLocalStorage } from "@/app/components/detailedList/detailedList.config";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa";
import { useParams } from "next/navigation";
import { Loader } from "@/app/components/loader.component";
import { Popover } from "@/app/lib/popover/popover.component";
import { ObjectHelper } from "@/app/lib/object.helper";

function LocationExtensiveViewModalHeader(props: {
  countryName: string | null;
  ownedLocations: IGameState["ownedLocations"];
  config: IStoredLocationListConfig;
  setSearch: (search: string) => void;
  toggleColumnVisibility: (column: keyof IStoredLocationListConfig["columnVisibility"]) => void;
}) {
  return (
    <div className=" w-full flex flex-row items-center h-12 pb-2 z-10">
      {/* z-index so that the header stays above modal content */}
      <>
        <span>Locations</span>
        {props.countryName && (
          <span className="ml-1 shrink-0">
            {" "}
            of{" "}
            <span className="text-yellow-500 text-bold">
              {props.countryName}
            </span>
          </span>
        )}
      </>

      <div className="flex flex-row items-center gap-1 ml-16">
        <IoSearch color="white" size={16}></IoSearch>
        <input
          type="text"
          placeholder="Search for a location..."
          value={props.config.search ?? ""}
          onChange={(e) => props.setSearch(e.target.value)}
          style={{ outline: "none" }}
        ></input>
      </div>



      <div className="relative ml-auto flex flex-row items-center gap-2">
        <Popover
          renderTrigger={({ isOpen, toggle }) => (
            <button
              type="button"
              className={[styles.iconButton, isOpen ? styles.buttonActive : ""].join(" ")}
              onClick={toggle}
            >
              <HiOutlineCog6Tooth color="white" size={24} />
            </button>
          )}
        >
          {ObjectHelper.getTypedEntries(props.config.columnVisibility).filter(([column]) => column !== columns[0].title).map(([column, visible]) => (
            <label key={column} className=" flex items-center gap-2 cursor-pointer hover:bg-stone-600 rounded-md " onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              props.toggleColumnVisibility(column)
            }}>
              {visible ? <FaRegEye color="white" size={16} /> : <FaRegEyeSlash color="white" size={16} />}
              <span>{column}</span>
            </label>
          ))}
        </Popover>

        <CountryStats
          className="ml-auto border-stone-500 border rounded-md px-2 py-1 items-center flex-none"
          ownedLocations={props.ownedLocations}
        ></CountryStats>
      </div>


    </div>
  );
}

export interface ILocationDetailedViewData {
  constructibleData: IConstructibleLocation;
  temporaryLocationData: ITemporaryLocationData;
  baseLocationGameData: ILocationGameData;
  pinned?: boolean;
  proximity: number | null;
  constructibleState: NewConstructibleState;
  computedLocationData: {
    harborSuitability: number;
  }
}

export function DetailedLocationListModal() {
  const modalInstanceContext = useContext(ModalInstanceContext);
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  const proximityComputation = useSyncExternalStore(
    proximityComputationController.subscribe.bind(
      proximityComputationController,
    ),
    () => proximityComputationController.getSnapshot(),
  );
  const gameData = useContext(AppContext).gameData;
  if (!modalInstanceContext) {
    throw new Error(
      "[DetailedLocationViewModal] must be used within a ModalInstanceContext provider",
    );
  }
  const version = useParams().version as string;
  const [storedLocationListConfig, setStoredLocationListConfig] = useState<IStoredLocationListConfig | null>(null);

  const togglePin = useCallback(
    (location: ILocationIdentifier) => {
      setStoredLocationListConfig((prev) => {
        if (!prev) return null;
        const newPinned = { ...prev.pinnedLocations };
        if (location in newPinned) {
          delete newPinned[location];
        } else {
          newPinned[location] = true;
        }
        return { ...prev, pinnedLocations: newPinned };
      });
    },
    [],
  );

  const toggleColumnVisibility = useCallback(
    (column: keyof IStoredLocationListConfig["columnVisibility"]) => {
      console.log("toggleColumnVisibility", column);
      setStoredLocationListConfig((prev) => {
        if (!prev) return null;
        const newState = {
          ...prev, columnVisibility: {
            ...prev.columnVisibility,
            [column]: !prev.columnVisibility[column],
          }
        }
        return newState;
      });
    }, []
  );

  const toggleSort = useCallback((column: string) => {
    setStoredLocationListConfig((prev) => {
      if (!prev) return null;
      const newConfig = { ...prev };
      if (!newConfig.sort || newConfig.sort.column !== column) {
        newConfig.sort = { column, order: "asc" };
      } else if (newConfig.sort.order === "asc") {
        newConfig.sort = { column, order: "desc" };
      } else {
        newConfig.sort = null;
      }
      return newConfig;
    });
  }, []);

  const setSearch = useCallback((search: string) => {
    setStoredLocationListConfig((prev) => {
      if (!prev) return null;
      const newConfig = { ...prev };
      newConfig.search = search;
      return newConfig;
    });
  }, []);

  useEffect(() => {
    const config = loadConfigFromLocalStorage(gameState.countryCode ?? "CUSTOM", version);
    queueMicrotask(() => setStoredLocationListConfig(config));
  }, [gameState.countryCode, version]);

  useEffect(() => {
    // save config whenever it changes
    if (storedLocationListConfig !== null) {
      saveConfigToLocalStorage(gameState.countryCode ?? "CUSTOM", version, storedLocationListConfig);
    }
  }, [storedLocationListConfig]);

  const eligibleBuildingService = useMemo(() =>
    gameData && new EligibleBuildingService(gameData) || null, [gameData]);

  // TODO: optimize this ^^
  const ownedLocations: Record<ILocationIdentifier, ILocationDetailedViewData> =
    useMemo(() => {
      const temporaryLocationData = gameState.temporaryLocationData;

      return Object.fromEntries(
        Object.entries(gameState.ownedLocations)
          .map(([key, value]) => {
            const locationGameData = gameData?.locationDataMap[key];
            if (!locationGameData) {
              throw new Error(
                "[DetailedLocationViewModal] location game data not found for location id: " +
                key,
              );
            }
            const data: ILocationDetailedViewData = {
              constructibleData: value,
              temporaryLocationData: temporaryLocationData[key] ?? {},
              baseLocationGameData: locationGameData,
              constructibleState: eligibleBuildingService?.getConstructibleState(key, gameState) ?? {},
              pinned: storedLocationListConfig ? key in storedLocationListConfig.pinnedLocations : false,
              proximity: ProximityComputationHelper.evaluationToProximity(
                proximityComputation.result[key]?.cost ?? 100,
              ),
              computedLocationData: {
                harborSuitability: locationGameData.naturalHarborSuitability + (Object.values(value.buildings).reduce((acc, building) => acc + (building.template.modifiers.harborSuitability ?? 0) * building.level, 0)),
              }
            }
            return [
              key,
              data
            ] as [string, ILocationDetailedViewData];
          })
          .filter(([key, value]) => {
            if (value.pinned) {
              return true;
            }
            return StringHelper.isInSearchQuery(key, storedLocationListConfig?.search ?? "");
          }),
      );
    }, [
      gameData,
      gameState,
      proximityComputation,
      eligibleBuildingService,
      storedLocationListConfig
    ]);

  return (
    <div className="h-[80vh] w-[85vw] flex flex-col overflow-x-hidden">
      {storedLocationListConfig ? (
        <>
          <LocationExtensiveViewModalHeader
            countryName={gameState.country?.templateData?.name ?? null}
            ownedLocations={gameState.ownedLocations}
            config={storedLocationListConfig}
            setSearch={setSearch}
            toggleColumnVisibility={toggleColumnVisibility}
          ></LocationExtensiveViewModalHeader>
          <DetailedLocationList
            capitalLocation={gameState.capitalLocation ?? null}
            ownedLocations={ownedLocations}
            config={storedLocationListConfig}
            togglePin={togglePin}
            toggleSort={toggleSort}
          ></DetailedLocationList>
        </>
      ) : <Loader className="w-full h-full" size={80}></Loader>}
    </div>
  );
}
