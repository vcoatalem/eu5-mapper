import { Observable } from "./observable";

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

class ZoomController extends Observable<IZoomState> {
  private currentZoomIndex: number;
  private isDraggingCheck: (() => boolean) | null = null;
  private wheelHandler: ((e: WheelEvent) => void) | null = null;
  private currentElement: HTMLElement | null = null;

  constructor() {
    super();
    this.currentZoomIndex = zoomSteps.indexOf(1);
    this.subject = {
      oldZoomLevel: zoomSteps[this.currentZoomIndex],
      zoomLevel: zoomSteps[this.currentZoomIndex],
      zoomIndex: this.currentZoomIndex,
    };
  }

  public setDraggingCheck(checkFn: () => boolean): void {
    this.isDraggingCheck = checkFn;
  }

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
        zoomController.zoomIn();
      } else {
        zoomController.zoomOut();
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
}

export const zoomController = new ZoomController();
