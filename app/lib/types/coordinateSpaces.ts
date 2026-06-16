import { Coordinate } from "@/app/lib/types/coordinate";

type Brand<T, B extends string> = T & { readonly __brand: B };

export type ScreenPoint = Brand<Coordinate, "screen">;
export type MapPoint = Brand<Coordinate, "map">;
export type TilePoint = Brand<Coordinate, "tileLocal">;
export type TileId = Brand<
  { readonly col: number; readonly row: number },
  "tileId"
>;
export type TileKey = Brand<string, "tileKey">;
export type MountedLayerKey = Brand<string, "mountedKey">;

export const ALL_LAYER_NAMES = [
  "color",
  "terrain",
  "border",
  "areas",
  "maritimePresences",
  "indicators",
  "roads",
  "constructibles",
] as const;
export type LayerName = (typeof ALL_LAYER_NAMES)[number];
export type PixelLayer = Extract<
  LayerName,
  "color" | "terrain" | "areas" | "maritimePresences" | "indicators"
>;
export type ShapeLayer = Extract<LayerName, "roads" | "constructibles">;

export type CameraTransform = {
  left: number;
  top: number;
  zoom: number;
  containerLeft: number;
  containerTop: number;
};

export function asMap(c: Coordinate): MapPoint {
  return c as MapPoint;
}

export function asScreen(x: number, y: number): ScreenPoint {
  return { x, y } as ScreenPoint;
}

export function screenToMap(p: ScreenPoint, cam: CameraTransform): MapPoint {
  return asMap({
    x: (p.x - cam.containerLeft - cam.left) / cam.zoom,
    y: (p.y - cam.containerTop - cam.top) / cam.zoom,
  });
}
