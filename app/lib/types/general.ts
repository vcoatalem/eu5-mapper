import { RoadKey, RoadType } from "@/app/lib/types/roads";
import { IBuildingInstance } from "./building";
import { IProximityComputationRule } from "./proximityComputationRules";
import { ILocationGameData } from "@/app/lib/types/location";
import { ICountryData, ICountryInstance } from "@/app/lib/types/country";
import { LocationRank } from "@/app/lib/types/locationRank";
import { BuildingTemplate } from "@/app/lib/types/buildingTemplate";

export type ILocationIdentifier = string; // location name

export interface IConstructibleLocation {
  rank: LocationRank;
  buildings: Record<string, IBuildingInstance>;
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
  buildingsTemplate: Record<string, BuildingTemplate>;
  proximityComputationRule: IProximityComputationRule;
  countriesData: Record<string, ICountryData>; //TODO: move this outside of mandatory game data. Can be loaded only when needed, stored in indexedDB, and read by specific components that need it
  roads: BaseRoadRecord; // overriden by gameState.roads
}
