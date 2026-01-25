// do not import other files in this file

export interface ISelectedLocationInfo {
  hexColor: string;
  name: string;
  // todo: fill
  locationLevel?: "none" | "rural" | "town" | "city";
}

export interface ILocationGameData {
  // todo: fill
  name: string;
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
  unconstructible?: boolean;
}

export type ILocationDataMap<ColorHex extends string = string> = Record<
  ColorHex,
  ILocationGameData
>;

export interface ICoordinate {
  x: number;
  y: number;
}
