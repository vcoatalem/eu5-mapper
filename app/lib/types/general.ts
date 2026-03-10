import { RoadKey, RoadType } from "@/app/lib/types/roads";
import { IProximityComputationRule } from "./proximityComputationRules";
import { ILocationGameData } from "@/app/lib/types/location";
import { ICountryData } from "@/app/lib/types/country";
import { BuildingTemplate } from "@/app/lib/types/buildingTemplate";

export type ILocationIdentifier = string; // location name

export type BaseRoadRecord = Record<RoadKey, RoadType>;
export type RoadRecord = Record<RoadKey, RoadType | null>;

export type ILocationDataMap = Record<ILocationIdentifier, ILocationGameData>;

export type ILocationIdentifierMap<
  HexColor extends string = string,
  LocationName extends string = string,
> = Record<HexColor, LocationName>;

export interface IGameData {
  locationDataMap: ILocationDataMap;
  colorToNameMap: ILocationIdentifierMap;
  buildingsTemplate: Record<string, BuildingTemplate>;
  proximityComputationRule: IProximityComputationRule;
  countriesData: Record<string, ICountryData>; //TODO: move this outside of mandatory game data. Can be loaded only when needed, stored in indexedDB, and read by specific components that need it
  roads: BaseRoadRecord; // overriden by gameState.roads
}
