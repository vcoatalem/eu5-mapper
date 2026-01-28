// do not import other files in this file

export type ILocationIdentifier = string; // location name

export interface ILocationGameData {
  name: string;
  hexColor: string;
  constructibleLocationCoordinate?: ICoordinate;
  topography:
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
    | "mountain_wasteland";
  vegetation:
    | null
    | "farmland"
    | "forest"
    | "woods"
    | "grasslands"
    | "sparse"
    | "jungle"
    | "desert";
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
  isCoastal: boolean; // computed from adjacency graph
  isOnRiver: boolean; // computed from adjacency graph
  isOnLake: boolean; // computed from adjacency graph
  // TODO: hasRoad: boolean;
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

type BuildingType = "rural" | "urban" | "city" | "common";

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
  level: "rural" | "town" | "city";
  buildings: IBuildingInstance[];
}

type RoadType = "gravel" | "paved" | "modern" | "rail";
type RoadRecordKey = `${string}<->${string}`; // location A <-> location B (location A < location B)
type RoadRecord = Record<
  RoadRecordKey,
  { type: RoadType; createdByUser: boolean }
>;

export interface IGameState {
  country: string;
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

export interface IGameData {
  locationDataMap: ILocationDataMap;
  colorToNameMap: ILocationIdentifierMap;
  buildingsTemplateMap: Record<string, IBuildingTemplate>;
  proximityComputationRule: IProximityComputationRule;
}
