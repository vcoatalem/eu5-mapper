import { RefObject } from "react";
import { gameStateController } from "./gameState.controller";
import { DrawingHelper } from "./drawing/drawing.helper";
import { ICoordinate, ILocationIdentifier } from "./types/general";
import type { ILocationDataMap } from "./types/general";
import { zoomController } from "@/app/lib/zoomController";

export type NeighborsPanelPlacement =
  | { x: number; y: number; side: "left" }
  | { x: number; y: number; side: "right" }
  | null;

export class CameraService {
  private container: RefObject<HTMLDivElement>;
  private colorCanvas: RefObject<HTMLCanvasElement>;
  private colorCanvasContext: CanvasRenderingContext2D | null;
  private layers: Array<{ ref: RefObject<HTMLCanvasElement> }> = [];

  private panAnimationState: {
    animating: boolean;
    startLeft: number;
    startTop: number;
    targetLeft: number;
    targetTop: number;
    startTime: number;
    duration: number;
    rafId: number | null;
  } | null = null;

  constructor(
    container: RefObject<HTMLDivElement | null>,
    colorCanvasRef: RefObject<HTMLCanvasElement | null>,
    layers: Array<{ ref: RefObject<HTMLCanvasElement | null> }>,
  ) {
    if (
      !container.current ||
      !colorCanvasRef.current ||
      layers.some((layer) => !layer.ref.current)
    ) {
      throw new Error(
        "[CameraService]: Cannot initialize CameraService, missing some input refs",
      );
    }
    this.container = container as RefObject<HTMLDivElement>;
    this.colorCanvas = colorCanvasRef as RefObject<HTMLCanvasElement>;
    this.layers = layers as Array<{ ref: RefObject<HTMLCanvasElement> }>;
    this.colorCanvasContext =
      colorCanvasRef.current.getContext("2d", {
        willReadFrequently: true,
      }) ?? null;

    if (!this.colorCanvasContext) {
      throw new Error(
        "[CameraService]: Cannot get 2D context from color canvas",
      );
    }
  }

  public getLocationAtPointer(event: MouseEvent): ILocationIdentifier | null {
    const rect = this.colorCanvas.current?.getBoundingClientRect();

    const relX = event.clientX - (rect?.left ?? 0);
    const relY = event.clientY - (rect?.top ?? 0);

    const imageX = relX / zoomController.getSnapshot().zoomLevel;
    const imageY = relY / zoomController.getSnapshot().zoomLevel;

    const imageData = this.colorCanvasContext?.getImageData(
      imageX,
      imageY,
      1,
      1,
    );

    if (!imageData) {
      return null;
    }

    const [r, g, b] = [
      parseInt(`${imageData.data[0]}`),
      parseInt(`${imageData.data[1]}`),
      parseInt(`${imageData.data[2]}`),
    ];

    const hexStr = [
      r.toString(16).padStart(2, "0"),
      g.toString(16).padStart(2, "0"),
      b.toString(16).padStart(2, "0"),
    ].join("");

    const locationName = gameStateController.findLocationName(hexStr) ?? null;
    return locationName;
  }

  // Smooth pan animation state

  /**
   * Smoothly pans the map so that the given (x, y) coordinates become the center of the viewport.
   * @param x Target map x coordinate
   * @param y Target map y coordinate
   * @param duration Animation duration in ms (default 600)
   */
  public panToCoordinate = (coordinate: ICoordinate, duration = 600) => {
    const colorCanvas = this.colorCanvas.current;
    const container = this.container.current;
    if (!colorCanvas || !container) return;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const zoom = zoomController.getSnapshot().zoomLevel;
    const targetLeft = centerX - coordinate.x * zoom;
    const targetTop = centerY - coordinate.y * zoom;
    // Use current left/top from style
    const startLeft = parseFloat(colorCanvas.style.left) || 0;
    const startTop = parseFloat(colorCanvas.style.top) || 0;
    if (this.panAnimationState && this.panAnimationState.rafId) {
      cancelAnimationFrame(this.panAnimationState.rafId);
    }
    this.panAnimationState = {
      animating: true,
      startLeft,
      startTop,
      targetLeft,
      targetTop,
      startTime: performance.now(),
      duration,
      rafId: null,
    };
    const animate = (now: number) => {
      if (!this.panAnimationState) return;
      const elapsed = now - this.panAnimationState.startTime;
      const t = Math.min(1, elapsed / this.panAnimationState.duration);
      // Ease in-out cubic
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const left =
        this.panAnimationState.startLeft +
        (this.panAnimationState.targetLeft - this.panAnimationState.startLeft) *
          ease;
      const top =
        this.panAnimationState.startTop +
        (this.panAnimationState.targetTop - this.panAnimationState.startTop) *
          ease;
      this.layers.forEach((layer) => {
        const canvas = layer.ref.current;
        if (canvas) {
          canvas.style.left = left + "px";
          canvas.style.top = top + "px";
        }
      });
      if (t < 1) {
        this.panAnimationState.rafId = requestAnimationFrame(animate);
      } else {
        this.panAnimationState = null;
      }
    };
    this.panAnimationState.rafId = requestAnimationFrame(animate);
  };

  public applyZoomLevel = (newZoom: number, oldZoom: number) => {
    const colorCanvas = this.colorCanvas.current;
    const container = this.container.current;

    if (!colorCanvas || !container) return;

    const containerRect = container.getBoundingClientRect();

    // Calculate center of viewport
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    // Get current position from style (source of truth)
    const currentLeft = parseFloat(colorCanvas.style.left);
    const currentTop = parseFloat(colorCanvas.style.top);

    if (isNaN(currentLeft) || isNaN(currentTop)) {
      console.warn(
        "[CameraService]: Invalid left or top position when applying zoom level",
      );
    }

    // Ensure oldZoom is valid (fallback to 1 if invalid)
    const validOldZoom = oldZoom > 0 ? oldZoom : 1;

    // Calculate the point on the canvas that's at the center of the viewport
    const canvasCenterX = (centerX - currentLeft) / validOldZoom;
    const canvasCenterY = (centerY - currentTop) / validOldZoom;

    // Calculate new position so that the same canvas point remains at the viewport center
    const newLeft = centerX - canvasCenterX * newZoom;
    const newTop = centerY - canvasCenterY * newZoom;

    this.layers.forEach(({ ref }) => {
      const canvas = ref.current;
      if (canvas) {
        canvas.style.transform = `scale(${newZoom})`;
        canvas.style.transformOrigin = "0 0";
        canvas.style.left = newLeft + "px";
        canvas.style.top = newTop + "px";
      }
    });
  };

  /**
   * Returns viewport (screen) coordinates and placement side for the neighbors panel
   * so it appears next to the given location (left or right of it depending on location position).
   */
  public getNeighborsPanelScreenPosition(
    locationName: ILocationIdentifier,
    locationDataMap: ILocationDataMap,
  ): NeighborsPanelPlacement {
    const coord = locationDataMap[locationName]?.centerCoordinates;

    const colorCanvas = this.colorCanvas.current;
    const container = this.container.current;
    if (!colorCanvas || !container) return null;

    const containerRect = container.getBoundingClientRect();
    const zoom = zoomController.getSnapshot().zoomLevel;
    const currentLeft = parseFloat(colorCanvas.style.left) || 0;
    const currentTop = parseFloat(colorCanvas.style.top) || 0;

    const screenX = containerRect.left + currentLeft + coord.x * zoom;
    const screenY = containerRect.top + currentTop + coord.y * zoom;

    const viewportCenterX = containerRect.left + containerRect.width / 2;
    const side = screenX >= viewportCenterX ? "left" : "right";

    return { x: screenX, y: screenY, side };
  }
}
