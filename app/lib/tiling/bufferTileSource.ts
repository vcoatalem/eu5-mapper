import { TileId } from "@/app/lib/types/coordinateSpaces";
import { TILE_SIZE, worldMapConfig } from "@/app/components/worldMap.config";
import { get2dContext } from "@/app/lib/utils/canvasUtils";

const W = worldMapConfig.width;
const H = worldMapConfig.height;
const TILE = TILE_SIZE;

// Module-level cache keyed by URL; survives Strict Mode remount
const bufCache = new Map<string, Promise<Uint8ClampedArray>>();

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
      reject(new Error(`[BufferTileSource] Failed to load: ${url}`));
    img.src = url;
  });
  bufCache.set(url, p);
  return p;
}

export class BufferTileSource {
  private terrainBuf: Uint8ClampedArray | null = null;
  private borderBuf: Uint8ClampedArray | null = null;

  async init(terrainUrl: string, borderUrl: string): Promise<void> {
    const [terrain, border] = await Promise.all([
      decodeUrl(terrainUrl),
      decodeUrl(borderUrl),
    ]);
    this.terrainBuf = terrain;
    this.borderBuf = border;
  }

  blit(
    layer: "terrain" | "border",
    tile: TileId,
    ctx: CanvasRenderingContext2D,
  ): void {
    const buf = layer === "terrain" ? this.terrainBuf : this.borderBuf;
    if (!buf) throw new Error(`[BufferTileSource] ${layer} buffer not ready`);
    const { col, row } = tile;
    const ox = col * TILE,
      oy = row * TILE;
    const img = ctx.createImageData(TILE, TILE);
    for (let r = 0; r < TILE; r++) {
      const srcOffset = ((oy + r) * W + ox) * 4;
      img.data.set(buf.subarray(srcOffset, srcOffset + TILE * 4), r * TILE * 4);
    }
    ctx.putImageData(img, 0, 0);
  }
}
