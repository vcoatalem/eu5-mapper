import { DisplayDevelopment } from "@/app/components/detailedList/displayDevelopment.component";
import { DisplayHarborSuitability } from "@/app/components/detailedList/displayHarborSuitability.component";
import { DisplayLocation } from "@/app/components/detailedList/displayLocation.component";
import { DisplayRank } from "@/app/components/detailedList/displayLocationRank.component";
import { DisplayPop } from "@/app/components/detailedList/displayPop.component";
import { DisplayProximity } from "@/app/components/detailedList/displayProximity.component";
import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { LocationsHelper } from "@/app/lib/locations.helper";
import { ILocationIdentifier } from "@/app/lib/types/general";
import { FaAnglesDown, FaAnglesUp } from "react-icons/fa6";
import { PiPlusLight, PiMinusLight } from "react-icons/pi";
import { DisplayBuildings } from "@/app/components/detailedList/displayBuildings.component";
import { ArrayHelper } from "@/app/lib/array.helper";
import { ConstructibleAction } from "@/app/lib/types/constructibleAction";
import { LocationRank } from "@/app/lib/types/locationRank";

export type SortOrder = "asc" | "desc" | null;

export interface IDetailedLocationListProps {
  ownedLocations: Record<ILocationIdentifier, ILocationDetailedViewData>;
  capitalLocation: ILocationIdentifier | null;
  config: IStoredLocationListConfig;
  togglePin: (location: ILocationIdentifier) => void;
  toggleSort: (column: string) => void;
}

export interface IStoredLocationListConfig {
  sort: { order: SortOrder; column: string } | null;
  pinnedLocations: Record<ILocationIdentifier, boolean>;
  search?: string;
  columnVisibility: Record<string, boolean>;
}

export const actionsMetadata: Record<
  ConstructibleAction["type"],
  {
    icon: React.ReactNode;
    tooltip: string;
  }
> = {
  upgrade: {
    icon: (
      <FaAnglesUp color="white" size={16}>
        {" "}
      </FaAnglesUp>
    ),
    tooltip: "Upgrade building",
  },
  downgrade: {
    icon: <FaAnglesDown color="white" size={16}></FaAnglesDown>,
    tooltip: "Downgrade building",
  },
  demolish: {
    icon: <PiMinusLight color="white" size={16}></PiMinusLight>,
    tooltip: "Remove building",
  },
  build: {
    icon: <PiPlusLight color="white" size={16}></PiPlusLight>,
    tooltip: "Add building",
  },
};

export const columns: Array<{
  title: string;
  cols: number;
  displayComponent: React.FC<{
    data: ILocationDetailedViewData;
    extensiveViewProps: IDetailedLocationListProps;
  }>;
  sortBy: (
    a: ILocationDetailedViewData,
    b: ILocationDetailedViewData,
  ) => number;
}> = [
  {
    title: "Location",
    cols: 2,
    displayComponent: DisplayLocation,
    sortBy: (a, b) =>
      a.baseLocationGameData.name.localeCompare(b.baseLocationGameData.name),
  },
  {
    title: "Proximity",
    cols: 1,
    displayComponent: DisplayProximity,
    sortBy: (a, b) => {
      const proxA = a.proximity ?? 0;
      const proxB = b.proximity ?? 0;
      return proxB - proxA;
    },
  },
  {
    title: "Development",
    cols: 1,
    displayComponent: DisplayDevelopment,
    sortBy: (a, b) => {
      const devA =
        a.temporaryLocationData.development ??
        a.baseLocationGameData.development ??
        0;
      const devB =
        b.temporaryLocationData.development ??
        b.baseLocationGameData.development ??
        0;
      return devB - devA;
    },
  },
  {
    title: "Population",
    cols: 1,
    displayComponent: DisplayPop,
    sortBy: (a, b) => {
      const popA =
        a.temporaryLocationData.population ??
        a.baseLocationGameData.population ??
        0;
      const popB =
        b.temporaryLocationData.population ??
        b.baseLocationGameData.population ??
        0;
      return popB - popA;
    },
  },
  {
    title: "Rank",
    cols: 1,
    displayComponent: DisplayRank,
    sortBy: (a, b) => {
      const rankings: Record<LocationRank, number> = {
        rural: 0,
        town: 1,
        city: 2,
      };
      const rankA = a.baseLocationGameData.rank
        ? rankings[a.baseLocationGameData.rank]
        : -1;
      const rankB = b.baseLocationGameData.rank
        ? rankings[b.baseLocationGameData.rank]
        : -1;
      return rankB - rankA;
    },
  },
  {
    title: "Harbor Suitability",
    cols: 1,
    displayComponent: DisplayHarborSuitability,
    sortBy: (a, b) => {
      if (!a.baseLocationGameData.isCoastal) {
        return 1;
      }
      if (!b.baseLocationGameData.isCoastal) {
        return -1;
      }
      const harborSuitabilityA = LocationsHelper.getLocationHarborSuitability(
        a.baseLocationGameData,
        a.constructibleData,
      );
      const harborSuitabilityB = LocationsHelper.getLocationHarborSuitability(
        b.baseLocationGameData,
        b.constructibleData,
      );
      return harborSuitabilityB - harborSuitabilityA;
    },
  },
  {
    title: "Buildings",
    cols: 6,
    displayComponent: DisplayBuildings,
    sortBy: (a, b) => 0, // no sorting for now
  },
];

export const defaultStoredLocationListConfig: IStoredLocationListConfig = {
  sort: null,
  pinnedLocations: {},
  search: undefined,
  columnVisibility: {
    ...ArrayHelper.reduceToRecord(
      columns,
      (col) => col.title,
      (_col) => true,
    ),
  },
};

const computeConfigKey = (countryName: string, version: string) => {
  return `detailedLocationListConfig:${countryName}:${version}`;
};

export function saveConfigToLocalStorage(
  countryCode: string,
  version: string,
  config: IStoredLocationListConfig,
) {
  const key = computeConfigKey(countryCode, version);
  console.log(
    "[DetailedListConfig] saving config to localStorage",
    key,
    config,
  );
  localStorage.setItem(key, JSON.stringify(config));
}

export function loadConfigFromLocalStorage(
  countryCode: string,
  version: string,
): IStoredLocationListConfig {
  const key = computeConfigKey(countryCode, version);
  const config = localStorage.getItem(key);
  if (config) {
    console.log("[DetailedListConfig] loaded config from localStorage", config);
    return JSON.parse(config) as IStoredLocationListConfig;
  }
  return defaultStoredLocationListConfig;
}
