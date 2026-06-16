"use client";

import {
  LayerName,
  TileId,
  MountedLayerKey,
  ALL_LAYER_NAMES,
} from "@/app/lib/types/coordinateSpaces";
import { LayerInvalidationModel } from "@/app/lib/layerInvalidation.model";
import { CameraController } from "@/app/lib/cameraController";
import { LayerVisibilityModel, ILayerVisibilityState } from "@/app/lib/layerVisibility.model";
import { TileRenderer } from "@/app/lib/tiling/tileRenderer";
import {
  mountedKey, mountedKeyLayer, parseMountedLayerKey,
  makeTileId, visibleTileRange,
} from "@/app/lib/tiling/tileMath";
import { TILE_SIZE } from "@/app/components/worldMap.config";
import { get2dContext } from "@/app/lib/utils/canvasUtils";

const TILE = TILE_SIZE;

// 'color' is intentionally absent: it's the hit-test ID map, never rendered to screen
const LAYER_NAMES = ALL_LAYER_NAMES.filter((l) => l !== "color");
const LAYER_Z: Record<LayerName, number> = {
  color: 0,
  areas: 2,
  terrain: 3,
  border: 4,
  maritimePresences: 5,
  roads: 7,
  constructibles: 8,
  indicators: 10,
};

type TileEntry = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dirty: boolean;
};

export class TileVirtualizationManager {
  private layerContainers: Record<LayerName, HTMLDivElement>;
  private mounted = new Map<MountedLayerKey, TileEntry>();
  private pool: Record<LayerName, HTMLCanvasElement[]>;
  private subs: Array<() => void> = [];
  private active = false;
  private rafId: number | null = null;

  constructor(
    private world: HTMLDivElement,
    private tileRenderer: TileRenderer,
    private layerInvalidation: LayerInvalidationModel,
    private camera: CameraController,
    private layerVisibility: LayerVisibilityModel,
  ) {
    // Dark background fill (replaces the old solid-color canvas)
    const bg = document.createElement("div");
    bg.style.cssText = `position:absolute;top:0;left:0;width:${16384}px;height:${8192}px;background:#4a4a4a;z-index:-1`;
    world.appendChild(bg);

    // Build one container div per layer inside world
    this.pool = Object.fromEntries(
      LAYER_NAMES.map((l) => [l, []]),
    ) as unknown as Record<LayerName, HTMLCanvasElement[]>;
    this.layerContainers = Object.fromEntries(
      LAYER_NAMES.map((layer) => {
        const div = document.createElement("div");
        div.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;z-index:${LAYER_Z[layer]}`;
        world.appendChild(div);
        return [layer, div];
      }),
    ) as Record<LayerName, HTMLDivElement>;

    this.subs.push(
      this.layerInvalidation.subscribe(({ dirty }) => {
        for (const layer of dirty) {
          for (const [key, entry] of this.mounted) {
            if (mountedKeyLayer(key) === layer) entry.dirty = true;
          }
        }
        this.tick();
      }),
    );

    this.subs.push(this.camera.subscribe(() => this.tick()));
    this.subs.push(this.camera.subscribePanStart(() => this.startLoop()));
    this.subs.push(this.camera.subscribePanEnd(() => this.stopLoop()));

    this.subs.push(
      this.layerVisibility.subscribe((state) => {
        for (const layer of LAYER_NAMES) {
          const vis = this.computeVisibility(layer, state);
          this.layerContainers[layer].style.visibility = vis;
          if (vis === "hidden") this.unmountLayer(layer);
          else this.tick();
        }
      }),
    );
  }

  startLoop(): void {
    if (this.active) return;
    this.active = true;
    this.scheduleLoop();
  }

  stopLoop(): void {
    this.active = false;
  }

  tick(): void {
    this.reconcile();
  }

  private scheduleLoop: () => void = () => {
    this.reconcile();
    if (this.active) this.rafId = requestAnimationFrame(this.scheduleLoop);
    else this.rafId = null;
  };

  private reconcile(): void {
    const cameraTransform = this.camera.getCameraTransform();
    if (!cameraTransform) return;

    const viewport = {
      w: this.world.parentElement?.clientWidth ?? window.innerWidth,
      h: this.world.parentElement?.clientHeight ?? window.innerHeight,
    };
    const range = visibleTileRange(cameraTransform, viewport);
    const visibilityState = this.layerVisibility.getSnapshot();

    for (const layer of LAYER_NAMES) {
      if (this.computeVisibility(layer, visibilityState) === "hidden") continue;

      const needed = new Set<MountedLayerKey>();
      for (let col = range.colStart; col < range.colEnd; col++) {
        for (let row = range.rowStart; row < range.rowEnd; row++) {
          needed.add(mountedKey(layer, col, row));
        }
      }

      for (const key of [...this.mounted.keys()]) {
        if (mountedKeyLayer(key) === layer && !needed.has(key)) this.unmount(key);
      }

      for (const key of needed) {
        const { col, row } = parseMountedLayerKey(key);
        const tile = makeTileId(col, row);

        let entry = this.mounted.get(key);
        if (!entry) entry = this.mountTile(layer, tile, key);
        if (entry.dirty) {
          this.tileRenderer.renderTile(layer, tile, entry.ctx);
          entry.dirty = false;
        }
      }
    }
  }

  private mountTile(layer: LayerName, tile: TileId, key: MountedLayerKey): TileEntry {
    const pooled = this.pool[layer].pop();
    const canvas = pooled ?? document.createElement("canvas");
    if (!pooled) {
      canvas.width = TILE;
      canvas.height = TILE;
    } else {
      get2dContext(canvas).clearRect(0, 0, TILE, TILE);
    }
    canvas.style.cssText = [
      "position:absolute",
      `left:${tile.col * TILE}px`,
      `top:${tile.row * TILE}px`,
      `width:${TILE}px`,
      `height:${TILE}px`,
      "image-rendering:pixelated",
      "z-index:1",
    ].join(";");

    this.layerContainers[layer].appendChild(canvas);
    const ctx = get2dContext(canvas);
    const entry: TileEntry = { canvas, ctx, dirty: true };
    this.mounted.set(key, entry);
    return entry;
  }

  private unmount(key: MountedLayerKey): void {
    const entry = this.mounted.get(key);
    if (!entry) return;
    entry.canvas.parentElement?.removeChild(entry.canvas);
    const layer = mountedKeyLayer(key);
    this.pool[layer].push(entry.canvas);
    this.mounted.delete(key);
  }

  private unmountLayer(layer: LayerName): void {
    for (const key of [...this.mounted.keys()]) {
      if (mountedKeyLayer(key) === layer) this.unmount(key);
    }
  }

  private computeVisibility(
    layer: LayerName,
    state: ILayerVisibilityState,
  ): "visible" | "hidden" {
    const vis = state.layerVisibility[layer];
    if (!vis) return "visible";
    return (vis.forced ?? vis.set ?? "visible") as "visible" | "hidden";
  }

  dispose(): void {
    this.active = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.subs.forEach((u) => u());
    this.subs = [];
    for (const key of [...this.mounted.keys()]) this.unmount(key);
    this.mounted.clear();
    for (const div of Object.values(this.layerContainers)) {
      div.parentElement?.removeChild(div);
    }
  }
}
