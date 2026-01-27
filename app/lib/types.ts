// do not import other files in this file

export type ILocationIdentifier = string; // location name

export interface ILocationGameData {
  // todo: fill
  name: string;
  hexColor: string;
  topography:
    | "unknown"
    | "hills"
    | "wetlands"
    | "mountains"
    | "flatlands"
    | "farmland"
    | "lakes"
    | "plateau"
    | "ocean"
    | "coastal_ocean"
    | "narrows"
    | "inland_sea"
    | "ocean_wasteland"
    | "mountain_wasteland";
  vegetation: null | "forest" | "woods" | "sparse" | "jungle" | "desert";
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
}

type PlacementRestrictions =
  | "is_coastal"
  | "has_river"
  | "is_adjacent_to_lake"
  | "has_road";

interface IBuildingTemplate {
  name: string;
  levels: number;
  harborCapacity: number[]; // harbor capacity increment per level
  proximityCostReductionPercentage: number[]; // percentage reduction per level
  placementRestriction?: [PlacementRestrictions];
  locationRestriction?: Array<ILocationIdentifier>;
  countryRestriction?: Array<string>;
}

interface IBuildingInstance {
  template: IBuildingTemplate;
  level: number;
  createdByUser: boolean; // can be destroyed if false ? should check
}

interface IConstructibleLocation {
  level: "rural" | "town" | "city";
  buildings: IBuildingInstance[];
}

type RoadType = "gravel" | "paved" | "modern" | "rail";
type RoadRecordKey = `${string}<->${string}`; // location A <-> location B (location A < location B)
type RoadRecord = Record<
  RoadRecordKey,
  { type: RoadType; createdByUser: boolean }
>;

interface GameSetup {
  country: string;
  roads: RoadRecord; // all roads in the game, not only in our country ? see how many that represents & assess
  constructibleLocations: Record<ILocationIdentifier, IConstructibleLocation>; // all constructible in the game, not just ours ? Probably too ambitious. Lets just keep our own in there. Altough when acquiring a location, we should initialize at the proper level / buildings.

  ownedLocations: Array<ILocationIdentifier>;
}

export type ILocationDataMap<LocationName extends string = string> = Record<
  LocationName,
  ILocationGameData
>;

export type ILocationIdentifierMap<
  HexColor extends string = string,
  LocationName extends string = string
> = Record<HexColor, LocationName>;

export interface ICoordinate {
  x: number;
  y: number;
}
