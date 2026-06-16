import { TILE_SIZE } from "@/app/components/worldMap.config";
import { zoomLevels } from "@/app/lib/cameraController";
import {
  ColorHelper,
  capitalColor,
  defaultAreaColor,
} from "@/app/lib/drawing/color.helper";
import { DrawingHelper } from "@/app/lib/drawing/drawing.helper";
import { LayerInvalidationModel } from "@/app/lib/layerInvalidation.model";
import { LocationColorIndex } from "@/app/lib/locationColorIndex";
import { BufferTileSource } from "@/app/lib/tiling/bufferTileSource";
import {
  bboxIntersectsTile,
  pointBbox,
  roadBbox,
  tileKey,
} from "@/app/lib/tiling/tileMath";
import { Coordinate } from "@/app/lib/types/coordinate";
import { LayerName, TileId } from "@/app/lib/types/coordinateSpaces";
import { LocationRank } from "@/app/lib/types/locationRank";

// Indicator highlight: semi-transparent white overlay
const HIGHLIGHT_R = 255,
  HIGHLIGHT_G = 255,
  HIGHLIGHT_B = 255,
  HIGHLIGHT_A = 128;

// Maritime presence: interpolates from low-presence deep blue to high-presence bright blue
const MARITIME_LOW_R = 12,
  MARITIME_LOW_G = 6,
  MARITIME_LOW_B = 183;
const MARITIME_HIGH_R = 2,
  MARITIME_HIGH_G = 166,
  MARITIME_HIGH_B = 255;
const MARITIME_A = 128;

function drawLocation(
  ctx: CanvasRenderingContext2D,
  level: LocationRank | null | undefined,
  zoomLevel: number,
  coordinate: Coordinate,
  isCapital: boolean,
): void {
  const color = isCapital ? capitalColor : defaultAreaColor;
  switch (level) {
    case "rural":
      if (zoomLevel >= zoomLevels.maxedIn) {
        DrawingHelper.drawCircle(ctx, coordinate, 2, color);
      }
      break;
    case "town":
      if (zoomLevel >= zoomLevels.strongIn) {
        DrawingHelper.drawSquare(ctx, coordinate, 4, color);
      }
      break;
    case "city":
      if (zoomLevel >= zoomLevels.lightIn) {
        DrawingHelper.drawPentagon(ctx, coordinate, 8, color);
      }
      break;
  }
}

export class TileRenderer {
  constructor(
    private layerInvalidation: LayerInvalidationModel,
    private idMap: LocationColorIndex,
    private tiles: BufferTileSource,
  ) {}

  renderTile(
    layer: LayerName,
    tile: TileId,
    ctx: CanvasRenderingContext2D,
  ): void {
    switch (layer) {
      case "color":
        return this.idMap.drawColorTile(tile, ctx);
      case "terrain":
      case "border":
        return this.tiles.blit(layer, tile, ctx);
      case "areas":
        return this.drawAreasTile(tile, ctx);
      case "maritimePresences":
        return this.drawMaritimeTile(tile, ctx);
      case "indicators":
        return this.drawIndicatorsTile(tile, ctx);
      case "roads":
        return this.drawRoadsTile(tile, ctx);
      case "constructibles":
        return this.drawConstructiblesTile(tile, ctx);
    }
  }

  private drawAreasTile(tile: TileId, ctx: CanvasRenderingContext2D): void {
    const { col, row } = tile;
    const ox = col * TILE_SIZE,
      oy = row * TILE_SIZE;
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const bucket = this.layerInvalidation.tileBucket(tileKey(tile));
    const owned = this.layerInvalidation.ownedLocations();
    for (const [loc, coords] of bucket ?? []) {
      if (!(loc in owned)) continue;
      const [r, g, b] = ColorHelper.getEvaluationColor(
        this.layerInvalidation.proximityCost(loc),
      );
      for (const { x, y } of coords) {
        const i = ((y - oy) * TILE_SIZE + (x - ox)) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private drawIndicatorsTile(
    tile: TileId,
    ctx: CanvasRenderingContext2D,
  ): void {
    const { col, row } = tile;
    const ox = col * TILE_SIZE,
      oy = row * TILE_SIZE;
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const bucket = this.layerInvalidation.tileBucket(tileKey(tile));
    const highlighted = new Set(this.layerInvalidation.highlights());
    for (const [loc, coords] of bucket ?? []) {
      if (!highlighted.has(loc)) continue;
      for (const { x, y } of coords) {
        const i = ((y - oy) * TILE_SIZE + (x - ox)) * 4;
        img.data[i] = HIGHLIGHT_R;
        img.data[i + 1] = HIGHLIGHT_G;
        img.data[i + 2] = HIGHLIGHT_B;
        img.data[i + 3] = HIGHLIGHT_A;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private drawMaritimeTile(tile: TileId, ctx: CanvasRenderingContext2D): void {
    const { col, row } = tile;
    const ox = col * TILE_SIZE,
      oy = row * TILE_SIZE;
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const bucket = this.layerInvalidation.tileBucket(tileKey(tile));
    for (const [loc, coords] of bucket ?? []) {
      const presence =
        this.layerInvalidation.temporaryLocationData(loc)?.maritimePresence;
      if (!presence) continue;
      const t = Math.max(0, Math.min(100, presence)) / 100;
      const r = Math.round(
        MARITIME_LOW_R + (MARITIME_HIGH_R - MARITIME_LOW_R) * t,
      );
      const g = Math.round(
        MARITIME_LOW_G + (MARITIME_HIGH_G - MARITIME_LOW_G) * t,
      );
      const b = Math.round(
        MARITIME_LOW_B + (MARITIME_HIGH_B - MARITIME_LOW_B) * t,
      );
      for (const { x, y } of coords) {
        const i = ((y - oy) * TILE_SIZE + (x - ox)) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = MARITIME_A;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private drawRoadsTile(tile: TileId, ctx: CanvasRenderingContext2D): void {
    const { col, row } = tile;
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.save();
    ctx.translate(-col * TILE_SIZE, -row * TILE_SIZE);
    for (const road of this.layerInvalidation.roads()) {
      if (bboxIntersectsTile(roadBbox(road), tile)) {
        DrawingHelper.drawLine(ctx, {
          canvasCoordFrom: road.from,
          canvasCoordTo: road.to,
          lineWidth: 1,
          color: ColorHelper.getRoadHexColor(road.type),
        });
      }
    }
    ctx.restore();
  }

  private drawConstructiblesTile(
    tile: TileId,
    ctx: CanvasRenderingContext2D,
  ): void {
    const { col, row } = tile;
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.save();
    ctx.translate(-col * TILE_SIZE, -row * TILE_SIZE);
    const zoom = this.layerInvalidation.currentZoom().zoomLevel;
    const owned = this.layerInvalidation.ownedLocations();
    const capital = this.layerInvalidation.capitalLocation();
    for (const [loc, constructible] of Object.entries(owned)) {
      const coord = this.layerInvalidation.locationCenter(loc);
      if (coord && bboxIntersectsTile(pointBbox(coord), tile)) {
        drawLocation(ctx, constructible.rank, zoom, coord, loc === capital);
      }
    }
    ctx.restore();
  }
}
