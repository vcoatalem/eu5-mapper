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
