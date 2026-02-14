import { RefObject } from "react";
import { Observable } from "./observable";
import { gameStateController } from "./gameState.controller";
import { DrawingHelper } from "./drawing/drawing.helper";
import { ICoordinate, ILocationIdentifier } from "./types/general";
import type { ILocationDataMap } from "./types/general";

export const zoomLevels = {
  maxedOut: 0.1,
  strongOut: 0.3,
  lightOut: 0.7,
  normal: 1,
  lightIn: 1.5,
  strongIn: 3,
  maxedIn: 5,
};

const zoomSteps = Object.values(zoomLevels).sort((a, b) => a - b);

export interface IZoomState {
  oldZoomLevel: number;
  zoomLevel: number;
  zoomIndex: number;
}

export type ZoomListener = (zoom: IZoomState) => void;

export class CameraController extends Observable<IZoomState> {
  // Zoom state
  private currentZoomIndex: number;
  private isDraggingCheck: (() => boolean) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private currentElement: HTMLElement | null = null;

  // Camera state
  private container: RefObject<HTMLDivElement> | null = null;
  private colorCanvas: RefObject<HTMLCanvasElement> | null = null;
  private colorCanvasContext: CanvasRenderingContext2D | null = null;
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
    resolve?: () => void;
  } | null = null;

  constructor() {
    super();
    this.currentZoomIndex = zoomSteps.indexOf(1);
    this.subject = {
      oldZoomLevel: zoomSteps[this.currentZoomIndex],
      zoomLevel: zoomSteps[this.currentZoomIndex],
      zoomIndex: this.currentZoomIndex,
    };
  }

  /**
   * Initialize camera-related refs and contexts.
   */
  public initCamera(
    container: RefObject<HTMLDivElement | null>,
    colorCanvasRef: RefObject<HTMLCanvasElement | null>,
    layers: Array<{ ref: RefObject<HTMLCanvasElement | null> }>,
  ): void {
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

  public setDraggingCheck(checkFn: () => boolean): void {
    this.isDraggingCheck = checkFn;
  }

  /**
   * Initialize zoom controller on the given element.
   */
  public init(element: HTMLElement): void {
    // Clean up previous initialization if any
    this.cleanup();

    this.currentElement = element;
    this.wheelHandler = (e: WheelEvent) => {
      // Prevent zoom while dragging
      if (this.isDraggingCheck && this.isDraggingCheck()) {
        return;
      }
      if (e.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    };

    element.addEventListener("wheel", this.wheelHandler, { passive: true });
  }

  public cleanup(): void {
    if (this.currentElement && this.wheelHandler) {
      this.currentElement.removeEventListener("wheel", this.wheelHandler);
      this.currentElement = null;
      this.wheelHandler = null;
    }
  }

  private updateZoomState(oldZoomLevel: number): void {
    this.subject = {
      zoomIndex: this.currentZoomIndex,
      oldZoomLevel: oldZoomLevel,
      zoomLevel: zoomSteps[this.currentZoomIndex],
    };
    this.notifyListeners();
  }

  public zoomIn(): void {
    // Prevent zoom while dragging
    if (this.isDraggingCheck && this.isDraggingCheck()) {
      return;
    }
    const currentZoomLevel = zoomSteps[this.currentZoomIndex];
    if (this.currentZoomIndex < zoomSteps.length - 1) {
      this.currentZoomIndex++;
    }

    this.updateZoomState(currentZoomLevel);
  }

  public zoomOut(): void {
    // Prevent zoom while dragging
    if (this.isDraggingCheck && this.isDraggingCheck()) {
      return;
    }
    const currentZoomLevel = zoomSteps[this.currentZoomIndex];
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
    }

    this.updateZoomState(currentZoomLevel);
  }

  public zoomTo(zoomLevel: number): void {
    if (this.isDraggingCheck && this.isDraggingCheck()) {
      return;
    }
    if (Object.values(zoomLevels).includes(zoomLevel)) {
      const currentZoomLevel = zoomSteps[this.currentZoomIndex];
      this.currentZoomIndex = zoomSteps.indexOf(zoomLevel);
      this.updateZoomState(currentZoomLevel);
    }
  }

  /**
   * Synchronize internal zoom state without notifying listeners.
   * Useful when the camera has already been animated to the target zoom
   * and we only need zoom state to reflect the final value.
   */
  public syncZoomLevel(zoomLevel: number): void {
    if (!Object.values(zoomLevels).includes(zoomLevel)) {
      return;
    }
    this.currentZoomIndex = zoomSteps.indexOf(zoomLevel);
    this.subject = {
      zoomIndex: this.currentZoomIndex,
      zoomLevel: zoomLevel,
      oldZoomLevel: zoomLevel,
    };
  }

  public getLocationAtPointer(event: MouseEvent): ILocationIdentifier | null {
    if (!this.colorCanvas) return null;
    const rect = this.colorCanvas.current?.getBoundingClientRect();

    const relX = event.clientX - (rect?.left ?? 0);
    const relY = event.clientY - (rect?.top ?? 0);

    const imageX = relX / this.getSnapshot().zoomLevel;
    const imageY = relY / this.getSnapshot().zoomLevel;

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
  public panToCoordinate = (
    coordinate: ICoordinate,
    duration = 600,
    offset?: ICoordinate,
  ): Promise<void> => {
    if (!this.colorCanvas || !this.container) {
      return Promise.resolve();
    }
    const colorCanvas = this.colorCanvas.current;
    const container = this.container.current;
    if (!colorCanvas || !container) {
      return Promise.resolve();
    }
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const zoom = this.getSnapshot().zoomLevel;

    // If an offset is provided, shift the logical target point by that offset
    // so that the camera centers on (coordinate + offset).
    const effectiveX = coordinate.x + (offset?.x ?? 0);
    const effectiveY = coordinate.y + (offset?.y ?? 0);

    const targetLeft = centerX - effectiveX * zoom;
    const targetTop = centerY - effectiveY * zoom;
    // Use current left/top from style
    const startLeft = parseFloat(colorCanvas.style.left) || 0;
    const startTop = parseFloat(colorCanvas.style.top) || 0;

    // If there is an ongoing animation, cancel it and resolve its promise
    if (this.panAnimationState && this.panAnimationState.rafId) {
      cancelAnimationFrame(this.panAnimationState.rafId);
      if (this.panAnimationState.resolve) {
        this.panAnimationState.resolve();
      }
    }

    return new Promise<void>((resolve) => {
      this.panAnimationState = {
        animating: true,
        startLeft,
        startTop,
        targetLeft,
        targetTop,
        startTime: performance.now(),
        duration,
        rafId: null,
        resolve,
      };

      const animate = (now: number) => {
        if (!this.panAnimationState) return;
        const elapsed = now - this.panAnimationState.startTime;
        const t = Math.min(1, elapsed / this.panAnimationState.duration);
        // Ease in-out cubic
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const left =
          this.panAnimationState.startLeft +
          (this.panAnimationState.targetLeft -
            this.panAnimationState.startLeft) *
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
          const state = this.panAnimationState;
          this.panAnimationState = null;
          if (state && state.resolve) {
            state.resolve();
          }
        }
      };

      this.panAnimationState.rafId = requestAnimationFrame(animate);
    });
  };

  public applyZoomLevel = (newZoom: number, oldZoom: number) => {
    if (!this.colorCanvas || !this.container) return;
    const colorCanvas = this.colorCanvas.current;
    const container = this.container.current;

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

  baseScreenOffset = { left: 60, top: 40, bottom: 5, right: 0 };

  /**
   * Core tooltip placement algorithm operating in screen-space.
   *
   * @param baseX Screen-space x coordinate of the anchor point (in pixels).
   * @param baseY Screen-space y coordinate of the anchor point (in pixels).
   * @param containerRect Bounding rect of the camera container (used as viewport).
   */
  private computeTooltipScreenPosition(
    baseX: number,
    baseY: number,
    containerRect: DOMRect,
    offset: ICoordinate = { x: 0, y: 0 },
    tooltipSize: ICoordinate = { x: 200, y: 200 },
    screenOffset = this.baseScreenOffset,
    mouseCoordinate: ICoordinate = { x: 0, y: 0 },
  ): ICoordinate | null {
    const rawLeft = containerRect.left;
    const rawRight = containerRect.right;
    const rawTop = containerRect.top;
    const rawBottom = containerRect.bottom;

    const viewportLeft = rawLeft + (screenOffset.left ?? 0);
    const viewportRight = rawRight - (screenOffset.right ?? 0);
    const viewportTop = rawTop + (screenOffset.top ?? 0);
    const viewportBottom = rawBottom - (screenOffset.bottom ?? 0);

    const marginX = offset.x;
    const marginY = offset.y;
    const tooltipWidth = tooltipSize?.x ?? 0;
    const tooltipHeight = tooltipSize?.y ?? 0;
    // If we don't know the tooltip size, fall back to a simple
    // bottom-right offset from the anchor.
    if (tooltipWidth <= 0 || tooltipHeight <= 0) {
      const x = baseX + marginX;
      const y = baseY + marginY;
      return { x, y };
    }

    // Try to place the tooltip fully within the viewport in this order:
    // 1) bottom-right, 2) top-right, 3) top-left, 4) bottom-left of the anchor.
    type PlacementName =
      | "bottom-right"
      | "top-right"
      | "top-left"
      | "bottom-left";

    const candidates: Array<{
      name: PlacementName;
      panelLeft: number;
      panelTop: number;
    }> = [
      {
        name: "bottom-right",
        panelLeft: baseX + marginX,
        panelTop: baseY + marginY,
      },
      {
        name: "top-right",
        panelLeft: baseX + marginX,
        panelTop: baseY - marginY - tooltipHeight,
      },
      {
        name: "top-left",
        panelLeft: baseX - marginX - tooltipWidth,
        panelTop: baseY - marginY - tooltipHeight,
      },
      {
        name: "bottom-left",
        panelLeft: baseX - marginX - tooltipWidth,
        panelTop: baseY + marginY,
      },
    ];

    const fitsInViewport = (left: number, top: number): boolean => {
      const right = left + tooltipWidth;
      const bottom = top + tooltipHeight;
      return (
        left >= viewportLeft &&
        right <= viewportRight &&
        top >= viewportTop &&
        bottom <= viewportBottom
      );
    };

    const overlapsMouse = (left: number, top: number): boolean => {
      if (!mouseCoordinate) return false;
      const right = left + tooltipWidth;
      const bottom = top + tooltipHeight;
      const mx = mouseCoordinate.x;
      const my = mouseCoordinate.y;
      return mx >= left && mx <= right && my >= top && my <= bottom;
    };

    let chosen = candidates.find(
      (c) =>
        fitsInViewport(c.panelLeft, c.panelTop) &&
        !overlapsMouse(c.panelLeft, c.panelTop),
    );

    let panelLeft: number;
    let panelTop: number;
    let usedPlacement: PlacementName | "clamped";

    if (chosen) {
      panelLeft = chosen.panelLeft;
      panelTop = chosen.panelTop;
      usedPlacement = chosen.name;
    } else {
      // If none of the quadrants can contain the tooltip fully while also
      // respecting the mouse constraint, fall back to bottom-right and clamp
      // it inside the viewport as best effort. If even that ends up covering
      // the mouse pointer (and we know the mouse coordinate), we give up and
      // return null so the tooltip is not shown under the cursor.
      const primary = candidates[0]; // bottom-right
      const viewportWidth = viewportRight - viewportLeft;
      const viewportHeight = viewportBottom - viewportTop;

      if (tooltipWidth <= viewportWidth) {
        const maxLeft = viewportRight - tooltipWidth;
        const minLeft = viewportLeft;
        panelLeft = Math.min(Math.max(primary.panelLeft, minLeft), maxLeft);
      } else {
        panelLeft = viewportLeft;
      }

      if (tooltipHeight <= viewportHeight) {
        const maxTop = viewportBottom - tooltipHeight;
        const minTop = viewportTop;
        panelTop = Math.min(Math.max(primary.panelTop, minTop), maxTop);
      } else {
        panelTop = viewportTop;
      }

      if (mouseCoordinate && overlapsMouse(panelLeft, panelTop)) {
        return null;
      }

      usedPlacement = "clamped";
    }

    const x = panelLeft;
    const y = panelTop;

    return { x, y };
  }

  /**
   * Tooltip placement when the anchor is expressed in game/map coordinates
   * (affected by camera zoom and pan).
   */
  public getTooltipScreenPositionForLocation(
    anchorCoordinate: ICoordinate,
    offset: ICoordinate = { x: 0, y: 0 },
    tooltipSize: ICoordinate,
    mouseCoordinate?: ICoordinate,
  ): ICoordinate | null {
    if (!this.colorCanvas || !this.container) return null;
    const colorCanvas = this.colorCanvas.current;
    const container = this.container.current;
    if (!colorCanvas || !container) return null;

    const containerRect = container.getBoundingClientRect();
    const zoom = this.getSnapshot().zoomLevel;
    const currentLeft = parseFloat(colorCanvas.style.left) || 0;
    const currentTop = parseFloat(colorCanvas.style.top) || 0;

    const baseX = containerRect.left + currentLeft + anchorCoordinate.x * zoom;
    const baseY = containerRect.top + currentTop + anchorCoordinate.y * zoom;

    return this.computeTooltipScreenPosition(
      baseX,
      baseY,
      containerRect,
      offset,
      tooltipSize,
      this.baseScreenOffset,
      mouseCoordinate,
    );
  }

  /**
   * Tooltip placement when the anchor is already expressed in screen-space
   * DOM coordinates (e.g. clientX / clientY from a DOM element or event).
   */
  public getTooltipScreenPositionForScreenCoordinate(
    anchorCoordinate: ICoordinate,
    offset: ICoordinate = { x: 0, y: 0 },
    tooltipSize: ICoordinate,
    mouseCoordinate: ICoordinate,
  ): ICoordinate | null {
    if (!this.container) return null;
    const container = this.container.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const baseX = anchorCoordinate.x;
    const baseY = anchorCoordinate.y;

    return this.computeTooltipScreenPosition(
      baseX,
      baseY,
      containerRect,
      offset,
      tooltipSize,
      this.baseScreenOffset,
      mouseCoordinate,
    );
  }
}

export const cameraController = new CameraController();
