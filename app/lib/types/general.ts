// do not import other files in this file

import { IBuildingInstance, INewBuildingTemplate } from "./building";
import { IProximityBuffs, IProximityComputationRule } from "./proximityComputationRules";

export type ILocationIdentifier = string; // location name

export type LocationRank = "rural" | "town" | "city";
export type RoadType =
  | "gravel_road"
  | "paved_road"
  | "modern_road"
  | "rail_road";

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
export interface IConstructibleLocation {
  rank: LocationRank;
  buildings: Record<INewBuildingTemplate["name"], IBuildingInstance>;
}

export type RoadRecord = Record<
  ILocationIdentifier,
  Array<{ to: ILocationIdentifier; type: RoadType; createdByUser: boolean }>
>;

export interface ITemporaryLocationData {
  development?: number;
  population?: number;
  maritimePresence?: number;
}

export type TemporaryLocationDataRecord = Record<
  ILocationIdentifier,
  ITemporaryLocationData
>;

export interface IGameState {
  countryCode: string | null;
  country: ICountryInstance | null;
  roads: RoadRecord;
  ownedLocations: Record<ILocationIdentifier, IConstructibleLocation>;
  capitalLocation?: ILocationIdentifier;
  temporaryLocationData: TemporaryLocationDataRecord;
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
  templateData: ICountryData | null;
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
  buildingsTemplate: Record<string, INewBuildingTemplate>;
  proximityComputationRule: IProximityComputationRule;
  countriesDataMap: Record<string, ICountryData>; //TODO: move this outside of mandatory game data. Can be loaded only when needed, stored in indexedDB, and read by specific components that need it
  countryProximityBuffsTemplate: Record<string, Partial<IProximityBuffs>> //TODO: move this outside of mandatory game data. Can be loaded only when needed, stored in indexedDB, and read by specific components that need it
  roads: RoadRecord; // base roads initialized at the start of the game
}
