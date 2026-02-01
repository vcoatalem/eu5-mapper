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

  constructor() {
    super();
    this.currentZoomIndex = zoomSteps.indexOf(1);
    this.subject = {
      oldZoomLevel: zoomSteps[this.currentZoomIndex],
      zoomLevel: zoomSteps[this.currentZoomIndex],
      zoomIndex: this.currentZoomIndex,
    };
  }

  public init(element: HTMLElement): void {
    element.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomController.zoomOut();
      } else {
        zoomController.zoomIn();
      }
    });
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
    const currentZoomLevel = zoomSteps[this.currentZoomIndex];
    if (this.currentZoomIndex < zoomSteps.length - 1) {
      this.currentZoomIndex++;
    }

    this.updateZoomState(currentZoomLevel);
  }

  public zoomOut(): void {
    const currentZoomLevel = zoomSteps[this.currentZoomIndex];
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
    }

    this.updateZoomState(currentZoomLevel);
  }
}

export const zoomController = new ZoomController();
