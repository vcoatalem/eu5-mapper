"use client";

import { worldMapConfig } from "@/app/components/worldMap.config";
import { TILE_SIZE } from "@/app/components/worldMap.config";
import { MapPoint, TileId } from "@/app/lib/types/coordinateSpaces";
import { hexColorFromRgb, HexColor } from "@/app/lib/types/color";
import { get2dContext } from "@/app/lib/utils/canvasUtils";
import { workerManager } from "@/app/lib/workerManager";
import { workerManagerConfig } from "@/app/lib/workerManager.config";
import { IWorkerTaskInitWithImagePayload } from "@/workers/types/initWithImage";

const W = worldMapConfig.width;
const H = worldMapConfig.height;
const TILE = TILE_SIZE;

// Module-level cache keyed by URL; Promise-deduped; survives Strict Mode remount
const bufCache = new Map<string, Promise<Uint8ClampedArray>>();
// Track which URLs have already seeded workers to avoid double-seeding on remount
const seededUrls = new Set<string>();

async function decodeUrl(url: string): Promise<Uint8ClampedArray> {
  const existing = bufCache.get(url);
  if (existing) return existing;
  const p = new Promise<Uint8ClampedArray>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = get2dContext(canvas);
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, W, H).data);
    };
    img.onerror = () =>
      reject(new Error(`[LocationColorIndex] Failed to load: ${url}`));
    img.src = url;
  });
  bufCache.set(url, p);
  return p;
}

export class LocationColorIndex {
  private buf: Uint8ClampedArray | null = null;

  async init(imageUrl: string): Promise<void> {
    this.buf = await decodeUrl(imageUrl);

    // Seed worker copies (only once per URL; same URL on Strict Mode remount skips this)
    if (!seededUrls.has(imageUrl) && workerManager.isAvailable()) {
      seededUrls.add(imageUrl);
      const config = workerManagerConfig.workers.find((w) =>
        w.workerFileName.includes("canvas"),
      );
      if (config) {
        for (let i = 0; i < config.poolSize; i++) {
          const copy = new Uint8ClampedArray(this.buf);
          const payload: IWorkerTaskInitWithImagePayload = {
            pixelDataBuffer: copy.buffer,
            canvasWidth: W,
            canvasHeight: H,
          };
          workerManager.queueTask({
            id: `initWithImage-${i}-${Date.now()}`,
            type: "initWithImage",
            payload,
          });
        }
      }
    }
  }

  getColorAt(p: MapPoint): HexColor | null {
    if (!this.buf) return null;
    const px = Math.floor(p.x),
      py = Math.floor(p.y);
    if (px < 0 || px >= W || py < 0 || py >= H) return null;
    const i = (py * W + px) * 4;
    const r = this.buf[i],
      g = this.buf[i + 1],
      b = this.buf[i + 2];
    if (r === 0 && g === 0 && b === 0) return null; // black = no location
    return hexColorFromRgb(r, g, b);
  }

  drawColorTile(tile: TileId, ctx: CanvasRenderingContext2D): void {
    if (!this.buf) return;
    const { col, row } = tile;
    const ox = col * TILE,
      oy = row * TILE;
    const img = ctx.createImageData(TILE, TILE);
    for (let r = 0; r < TILE; r++) {
      const srcOffset = ((oy + r) * W + ox) * 4;
      img.data.set(
        this.buf.subarray(srcOffset, srcOffset + TILE * 4),
        r * TILE * 4,
      );
    }
    ctx.putImageData(img, 0, 0);
  }
}
