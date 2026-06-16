import {
  MapPoint,
  TileId,
  TileKey,
  MountedLayerKey,
  LayerName,
  CameraTransform,
  asMap,
} from "@/app/lib/types/coordinateSpaces";
import { TILE_SIZE, COLS, ROWS } from "@/app/components/worldMap.config";
import { ResolvedRoad } from "@/app/lib/types/renderTypes";

const TILE = TILE_SIZE;

export function makeTileId(col: number, row: number): TileId {
  return { col, row } as TileId;
}

export function mapToTileId(p: MapPoint): TileId {
  const col = Math.max(0, Math.min(Math.floor(p.x / TILE), COLS - 1));
  const row = Math.max(0, Math.min(Math.floor(p.y / TILE), ROWS - 1));
  return makeTileId(col, row);
}

export function tileKey(t: TileId): TileKey {
  return `${t.col}_${t.row}` as unknown as TileKey;
}

export function mountedKey(
  layer: LayerName,
  col: number,
  row: number,
): MountedLayerKey {
  return `${layer}|${col}_${row}` as unknown as MountedLayerKey;
}

export function parseMountedLayerKey(k: MountedLayerKey): {
  layer: LayerName;
  col: number;
  row: number;
} {
  const pipe = k.indexOf("|");
  const layer = k.slice(0, pipe) as LayerName;
  const [col, row] = k
    .slice(pipe + 1)
    .split("_")
    .map(Number);
  return { layer, col, row };
}

export function mountedKeyTile(k: MountedLayerKey): TileKey {
  return k.slice(k.indexOf("|") + 1) as unknown as TileKey;
}

export function mountedKeyLayer(k: MountedLayerKey): LayerName {
  return k.slice(0, k.indexOf("|")) as LayerName;
}

export function tileOrigin(t: TileId): MapPoint {
  return asMap({ x: t.col * TILE, y: t.row * TILE });
}

export type BBox = { x0: number; y0: number; x1: number; y1: number };

export function bboxIntersectsTile(bbox: BBox, t: TileId): boolean {
  const ox = t.col * TILE,
    oy = t.row * TILE;
  return (
    bbox.x1 >= ox && bbox.x0 < ox + TILE && bbox.y1 >= oy && bbox.y0 < oy + TILE
  );
}

export function roadBbox(road: ResolvedRoad): BBox {
  return {
    x0: Math.min(road.from.x, road.to.x),
    y0: Math.min(road.from.y, road.to.y),
    x1: Math.max(road.from.x, road.to.x),
    y1: Math.max(road.from.y, road.to.y),
  };
}

export function pointBbox(p: MapPoint): BBox {
  return { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
}

export function visibleTileRange(
  cam: CameraTransform,
  vp: { w: number; h: number },
  margin = 1,
) {
  // cam.left/top are container-relative; dividing by zoom gives world coords
  const x0 = (0 - cam.left) / cam.zoom;
  const y0 = (0 - cam.top) / cam.zoom;
  const x1 = (vp.w - cam.left) / cam.zoom;
  const y1 = (vp.h - cam.top) / cam.zoom;
  return {
    colStart: Math.max(0, Math.floor(x0 / TILE) - margin),
    colEnd: Math.min(COLS, Math.floor(x1 / TILE) + margin + 1),
    rowStart: Math.max(0, Math.floor(y0 / TILE) - margin),
    rowEnd: Math.min(ROWS, Math.floor(y1 / TILE) + margin + 1),
  };
}
