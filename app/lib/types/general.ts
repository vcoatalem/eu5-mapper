// do not import other files in this file

import { IProximityComputationRule } from "./proximityComputationRules";

export type ILocationIdentifier = string; // location name

export type LocationRank = "rural" | "town" | "city";
export type RoadType =
  | "gravel_road"
  | "paved_road"
  | "modern_road"
  | "rail_road";
export type BuildingType = "rural" | "urban" | "city" | "common";

export type Topography =
  | "unknown"
  | "hills"
  | "wetlands"
  | "mountains"
  | "flatlands"
  | "lakes"
  | "plateau"
  | "ocean"
  | "coastal_ocean"
  | "narrows"
  | "inland_sea"
  | "ocean_wasteland"
  | "mountain_wasteland"
  | "high_lakes";

export type Vegetation =
  | null
  | "farmland"
  | "forest"
  | "woods"
  | "grasslands"
  | "sparse"
  | "jungle"
  | "desert";

// all data in this instances of this interface should be read-only after init.
// they represent the static game data that is loaded into the game at the start of a new game
export interface ILocationGameData {
  name: string;
  hexColor: string;
  centerCoordinates: ICoordinate;
  topography: Topography;
  vegetation: Vegetation;
  isSea?: boolean;
  isLake?: boolean;
  ownable?: boolean;
  hierarchy: {
    continent: string;
    subcontinent: string;
    region: string;
    area: string;
    province: string;
  };
  naturalHarborSuitability: number;
  isCoastal: boolean;
  isOnRiver: boolean;
  isOnLake: boolean;
  rank: LocationRank;
  buildings: string[]; //building names
  development: number; // can me modified , in other interface (ILocationTemporaryData ?)
  population: number; // can me modified , in other interface (ILocationTemporaryData ?)
}

export type PlacementRestrictions =
  | "is_coastal"
  | "is_on_river"
  | "is_on_lake"
  | "has_road";

interface IPlacementRestrictionConfig {
  mode: "all" | "any"; // 'all' = every condition must be met, 'any' = at least one condition must be met
  conditions: PlacementRestrictions[];
}

export interface IBuildingTemplate {
  name: string;
  levels: number;
  type: BuildingType;
  harborCapacity: number[]; // harbor capacity increment per level
  proximityCostReductionPercentage: number[]; // percentage reduction per level
  localProximitySource?: number[]; // proximity cost reduction source per level
  placementRestriction?: IPlacementRestrictionConfig;
  locationRestriction?: Array<ILocationIdentifier>;
  countryRestriction?: Array<string>;
}

interface IBuildingInstance {
  template: IBuildingTemplate;
  level: number;
  createdByUser: boolean; // can be destroyed if false ? should check
}

export interface IConstructibleLocation {
  rank: LocationRank;
  buildings: IBuildingInstance[];
}

export type RoadRecord = Record<
  ILocationIdentifier,
  Array<{ to: ILocationIdentifier; type: RoadType; createdByUser: boolean }>
>;

export interface IGameState {
  countryCode: string | null;
  country: ICountryInstance | null;
  roads: RoadRecord;
  ownedLocations: Record<ILocationIdentifier, IConstructibleLocation>;
  capitalLocation?: ILocationIdentifier;
}

export type ILocationDataMap<LocationName extends string = string> = Record<
  LocationName,
  ILocationGameData
>;

export type ILocationIdentifierMap<
  HexColor extends string = string,
  LocationName extends string = string,
> = Record<HexColor, LocationName>;

export interface ICoordinate {
  x: number;
  y: number;
}

export interface ICountryData {
  capital: ILocationIdentifier;
  locations: ILocationIdentifier[];
  centralizationVsDecentralization: number; // from -100 (fully centralized) to 100 (fully decentralized)
  landVsNaval: number; // from -100 (fully land) to 100 (fully naval)
  name: string;
  flagUrl: string | null;
}

export interface ICountryInstance {
  values: ICountryValues;
  rulerAdministrativeAbility: number; // from 0 to 100, higher means more impact of proximity on the country
}

export interface ICountryValues {
  centralizationVsDecentralization: number;
  landVsNaval: number;
}

export interface IGameData {
  locationDataMap: ILocationDataMap;
  colorToNameMap: ILocationIdentifierMap;
  buildingsTemplateMap: Record<string, IBuildingTemplate>;
  proximityComputationRule: IProximityComputationRule;
  countriesDataMap: Record<string, ICountryData>;
  roads: RoadRecord; // base roads initialized at the start of the game
}
