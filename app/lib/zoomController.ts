import { Observable } from "./observable";

const zoomSteps = [0.1, 0.3, 0.7, 1, 1.5, 3, 5];

export type ZoomListener = (zoom: {
  oldZoomLevel: number;
  zoomLevel: number;
  zoomIndex: number;
}) => void;

export class ZoomController extends Observable<{
  oldZoomLevel: number;
  zoomLevel: number;
  zoomIndex: number;
}> {
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
