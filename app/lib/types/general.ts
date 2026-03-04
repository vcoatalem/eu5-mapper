import { RoadKey, RoadType } from "@/app/lib/types/roads";
import { IBuildingInstance, INewBuildingTemplate } from "./building";
import { IProximityComputationRule } from "./proximityComputationRules";
import { ILocationGameData, LocationRank } from "@/app/lib/types/location";
import { ICountryData, ICountryInstance } from "@/app/lib/types/country";

export type ILocationIdentifier = string; // location name

export interface IConstructibleLocation {
  rank: LocationRank;
  buildings: Record<INewBuildingTemplate["name"], IBuildingInstance>;
}

export type BaseRoadRecord = Record<RoadKey, RoadType>;
export type RoadRecord = Record<RoadKey, RoadType | null>;

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

export type ILocationDataMap = Record<ILocationIdentifier, ILocationGameData>;

export type ILocationIdentifierMap<
  HexColor extends string = string,
  LocationName extends string = string,
> = Record<HexColor, LocationName>;

export interface ICoordinate {
  x: number;
  y: number;
}

export interface IGameData {
  locationDataMap: ILocationDataMap;
  colorToNameMap: ILocationIdentifierMap;
  buildingsTemplate: Record<string, INewBuildingTemplate>;
  proximityComputationRule: IProximityComputationRule;
  countriesData: Record<string, ICountryData>; //TODO: move this outside of mandatory game data. Can be loaded only when needed, stored in indexedDB, and read by specific components that need it
  roads: BaseRoadRecord; // overriden by gameState.roads
}
