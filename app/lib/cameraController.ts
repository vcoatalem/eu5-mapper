import { worldMapConfig } from "@/app/components/worldMap.config";
import { LocationColorIndex } from "@/app/lib/locationColorIndex";
import { LocationsHelper } from "@/app/lib/locations.helper";
import { Coordinate } from "@/app/lib/types/coordinate";
import {
  asScreen,
  CameraTransform,
  screenToMap,
} from "@/app/lib/types/coordinateSpaces";
import { RefObject } from "react";
import { Observable } from "./observable";
import type { ModelInitParams } from "./types/model";
import type { GameData } from "./types/general";
import { LocationIdentifier } from "./types/general";

export const zoomLevels = {
  minOut: 0.5,
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
  isDragging: boolean;
}

export type ZoomListener = (zoom: IZoomState) => void;

export interface CameraControllerInitArgs {
  container: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  hitSurfaceRef: RefObject<HTMLDivElement | null>;
  locationColorIndex: LocationColorIndex;
  params: ModelInitParams;
}

export class CameraController extends Observable<IZoomState> {
  // Zoom state
  private currentZoomIndex: number;

  private container: RefObject<HTMLDivElement | null> | null = null;
  private world: RefObject<HTMLDivElement | null> | null = null;
  private locationColorIndex: LocationColorIndex | null = null;

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

  private panEndListeners: Array<() => void> = [];
  private panStartListeners: Array<() => void> = [];

  public subscribePanEnd(callback: () => void): () => void {
    this.panEndListeners.push(callback);
    return () => {
      const i = this.panEndListeners.indexOf(callback);
      if (i >= 0) this.panEndListeners.splice(i, 1);
    };
  }

  public subscribePanStart(callback: () => void): () => void {
    this.panStartListeners.push(callback);
    return () => {
      const i = this.panStartListeners.indexOf(callback);
      if (i >= 0) this.panStartListeners.splice(i, 1);
    };
  }

  constructor() {
    super();
    this.currentZoomIndex = zoomSteps.indexOf(1);
    this.subject = {
      oldZoomLevel: zoomSteps[this.currentZoomIndex],
      zoomLevel: zoomSteps[this.currentZoomIndex],
      zoomIndex: this.currentZoomIndex,
      isDragging: false,
    };
  }

  public setDragging(value: boolean): void {
    this.subject = { ...this.subject, isDragging: value };
    this.notifyListeners();
  }

  public getCameraTransform(): CameraTransform {
    const el = this.world?.current;
    if (!el || !this.container?.current) {
      return {
        left: 0,
        top: 0,
        zoom: this.getSnapshot().zoomLevel,
        containerLeft: 0,
        containerTop: 0,
      };
    }
    const cr = this.container.current.getBoundingClientRect();
    return {
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
      zoom: this.getSnapshot().zoomLevel,
      containerLeft: cr.left,
      containerTop: cr.top,
    };
  }

  /**
   * Initialize camera refs, contexts, and the wheel-zoom listener.
   */
  public init({
    container,
    worldRef,
    hitSurfaceRef,
    locationColorIndex,
    params,
  }: CameraControllerInitArgs): void {
    if (!container.current || !worldRef.current || !hitSurfaceRef.current) {
      throw new Error("[CameraController] init: missing refs");
    }
    this.container = container;
    this.world = worldRef;
    this.locationColorIndex = locationColorIndex;

    params.createManagedEventListener(hitSurfaceRef.current, "wheel", (e) => {
      // Prevent zoom while dragging
      if (this.subject.isDragging) {
        return;
      }
      if (e.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    });
  }

  private updateZoomState(oldZoomLevel: number): void {
    this.subject = {
      zoomIndex: this.currentZoomIndex,
      oldZoomLevel: oldZoomLevel,
      zoomLevel: zoomSteps[this.currentZoomIndex],
      isDragging: this.subject.isDragging,
    };
    this.applyZoomLevel(this.subject.zoomLevel, this.subject.oldZoomLevel);
    this.notifyListeners();
  }

  public zoomIn(): void {
    // Prevent zoom while dragging
    if (this.subject.isDragging) {
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
    if (this.subject.isDragging) {
      return;
    }
    const currentZoomLevel = zoomSteps[this.currentZoomIndex];
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
    }

    this.updateZoomState(currentZoomLevel);
  }

  public zoomTo(zoomLevel: number): void {
    if (this.subject.isDragging) {
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
      isDragging: this.subject.isDragging,
    };
  }

  public getLocationAtPointer(
    event: MouseEvent,
    gameData: GameData,
  ): LocationIdentifier | null {
    if (!gameData) return null;

    // New path: use offscreen LocationColorIndex for synchronous pixel read
    if (this.locationColorIndex) {
      const cameraTransform = this.getCameraTransform();
      const map = screenToMap(
        asScreen(event.clientX, event.clientY),
        cameraTransform,
      );
      const W = worldMapConfig.width,
        H = worldMapConfig.height;
      if (map.x < 0 || map.x >= W || map.y < 0 || map.y >= H) return null;
      const hex = this.locationColorIndex.getColorAt(map);
      if (!hex) return null;
      return LocationsHelper.findLocationName(hex, gameData) ?? null;
    }

    return null;
  }

  // Smooth pan animation state

  /**
   * Pans the map to a location's center coordinates, looked up from gameData.
   * No-ops if the location is missing or has no known coordinates.
   */
  public panToLocation(
    gameData: GameData,
    location: LocationIdentifier,
    duration = 0,
  ): Promise<void> {
    const coordinate = gameData.locationDataMap[location]?.centerCoordinates;
    if (!coordinate) {
      console.error(
        "[CameraController] panToLocation: missing coordinates for",
        location,
      );
      return Promise.resolve();
    }
    return this.panToCoordinate(coordinate, duration);
  }

  /**
   * Smoothly pans the map so that the given (x, y) coordinates become the center of the viewport.
   * @param x Target map x coordinate
   * @param y Target map y coordinate
   * @param duration Animation duration in ms (default 600)
   */
  public panToCoordinate = (
    coordinate: Coordinate,
    duration = 600,
    offset?: Coordinate,
  ): Promise<void> => {
    const movingEl: HTMLElement | null = this.world?.current ?? null;
    if (!movingEl || !this.container?.current) return Promise.resolve();

    const container = this.container.current;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const zoom = this.getSnapshot().zoomLevel;

    const effectiveX = coordinate.x + (offset?.x ?? 0);
    const effectiveY = coordinate.y + (offset?.y ?? 0);

    const targetLeft = centerX - effectiveX * zoom;
    const targetTop = centerY - effectiveY * zoom;
    const startLeft = parseFloat(movingEl.style.left) || 0;
    const startTop = parseFloat(movingEl.style.top) || 0;

    if (this.panAnimationState?.rafId) {
      cancelAnimationFrame(this.panAnimationState.rafId);
      this.panAnimationState.resolve?.();
    }

    console.debug(
      "[cam] panToCoordinate start — target:",
      coordinate,
      "isDragging:",
      this.subject.isDragging,
    );
    for (const notify of this.panStartListeners) notify();

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

        if (this.world?.current) {
          this.world.current.style.left = left + "px";
          this.world.current.style.top = top + "px";
        }

        if (t < 1) {
          this.panAnimationState.rafId = requestAnimationFrame(animate);
        } else {
          const state = this.panAnimationState;
          this.panAnimationState = null;
          for (const notify of this.panEndListeners) notify();
          state?.resolve?.();
        }
      };

      this.panAnimationState.rafId = requestAnimationFrame(animate);
    });
  };

  public applyZoomLevel = (newZoom: number, oldZoom: number) => {
    if (!this.container?.current) return;
    const container = this.container.current;
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const validOldZoom = oldZoom > 0 ? oldZoom : 1;

    if (!this.world?.current) return;
    const worldEl = this.world.current;
    const currentLeft = parseFloat(worldEl.style.left) || 0;
    const currentTop = parseFloat(worldEl.style.top) || 0;
    const canvasCenterX = (centerX - currentLeft) / validOldZoom;
    const canvasCenterY = (centerY - currentTop) / validOldZoom;
    worldEl.style.transform = `scale(${newZoom})`;
    worldEl.style.transformOrigin = "0 0";
    worldEl.style.left = centerX - canvasCenterX * newZoom + "px";
    worldEl.style.top = centerY - canvasCenterY * newZoom + "px";
  };

  baseScreenOffset = { left: 60, top: 40, bottom: 5, right: 0 };

  /**
   * Preferred placement for tooltip (vertical + horizontal). Used to try that quadrant first.
   */
  private static preferredToPlacementName(preferred: {
    horizontal: "left" | "right";
    vertical: "top" | "bottom";
  }): "bottom-right" | "top-right" | "top-left" | "bottom-left" {
    return `${preferred.vertical}-${preferred.horizontal}` as
      | "bottom-right"
      | "top-right"
      | "top-left"
      | "bottom-left";
  }

  /**
   * Core tooltip placement algorithm operating in screen-space.
   *
   * @param baseX Screen-space x coordinate of the anchor point (in pixels).
   * @param baseY Screen-space y coordinate of the anchor point (in pixels).
   * @param containerRect Bounding rect of the camera container (used as viewport).
   * @param preferredPlacement If set, this quadrant is tried first when fitting the tooltip.
   */
  private computeTooltipScreenPosition(
    baseX: number,
    baseY: number,
    containerRect: DOMRect,
    offset: Coordinate = { x: 0, y: 0 },
    tooltipSize: Coordinate = { x: 200, y: 200 },
    screenOffset = this.baseScreenOffset,
    mouseCoordinate: Coordinate = { x: 0, y: 0 },
    preferredPlacement?: {
      horizontal: "left" | "right";
      vertical: "top" | "bottom";
    },
  ): Coordinate | null {
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

    // Try to place the tooltip fully within the viewport. Order: preferred first (if any), then default order.
    type PlacementName =
      | "bottom-right"
      | "top-right"
      | "top-left"
      | "bottom-left";

    const allCandidates: Array<{
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

    const preferredName = preferredPlacement
      ? CameraController.preferredToPlacementName(preferredPlacement)
      : null;
    const candidates =
      preferredName != null
        ? [
            ...allCandidates.filter((c) => c.name === preferredName),
            ...allCandidates.filter((c) => c.name !== preferredName),
          ]
        : allCandidates;

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

    const chosen = candidates.find(
      (c) =>
        fitsInViewport(c.panelLeft, c.panelTop) &&
        !overlapsMouse(c.panelLeft, c.panelTop),
    );

    let panelLeft: number;
    let panelTop: number;

    if (chosen) {
      console.debug(
        "[CameraController] Tooltip placement chosen:",
        chosen.name,
        chosen.panelLeft,
        chosen.panelTop,
      );
      panelLeft = chosen.panelLeft;
      panelTop = chosen.panelTop;
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
    anchorCoordinate: Coordinate,
    offset: Coordinate = { x: 0, y: 0 },
    tooltipSize: Coordinate,
    mouseCoordinate?: Coordinate,
    preferredPlacement?: {
      horizontal: "left" | "right";
      vertical: "top" | "bottom";
    },
  ): Coordinate | null {
    if (!this.container?.current) return null;
    const movingEl = this.world?.current;
    if (!movingEl) return null;
    const container = this.container.current;

    const containerRect = container.getBoundingClientRect();
    const zoom = this.getSnapshot().zoomLevel;
    const currentLeft = parseFloat(movingEl.style.left) || 0;
    const currentTop = parseFloat(movingEl.style.top) || 0;

    const baseX = containerRect.left + currentLeft + anchorCoordinate.x * zoom;
    const baseY = containerRect.top + currentTop + anchorCoordinate.y * zoom;

    return this.computeTooltipScreenPosition(
      baseX,
      baseY,
      containerRect,
      offset,
      tooltipSize,
      this.baseScreenOffset,
      mouseCoordinate ?? { x: 0, y: 0 },
      preferredPlacement,
    );
  }

  /**
   * Tooltip placement when the anchor is already expressed in screen-space
   * DOM coordinates (e.g. clientX / clientY from a DOM element or event).
   */
  public getTooltipScreenPositionForScreenCoordinate(
    anchorCoordinate: Coordinate,
    offset: Coordinate = { x: 0, y: 0 },
    tooltipSize: Coordinate,
    mouseCoordinate: Coordinate,
    preferredPlacement?: {
      horizontal: "left" | "right";
      vertical: "top" | "bottom";
    },
  ): Coordinate | null {
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
      preferredPlacement,
    );
  }
}
