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
  type?: "forest" | "grassland";
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
