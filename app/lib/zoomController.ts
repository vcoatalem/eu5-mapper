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
  }

  public zoomIn(): void {
    const currentZoomLevel = zoomSteps[this.currentZoomIndex];
    if (this.currentZoomIndex < zoomSteps.length - 1) {
      this.currentZoomIndex++;
    }

    this.notifyListeners({
      zoomIndex: this.currentZoomIndex,
      oldZoomLevel: currentZoomLevel,
      zoomLevel: zoomSteps[this.currentZoomIndex],
    });
  }

  public zoomOut(): void {
    const currentZoomLevel = zoomSteps[this.currentZoomIndex];
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
    }

    this.notifyListeners({
      zoomIndex: this.currentZoomIndex,
      zoomLevel: zoomSteps[this.currentZoomIndex],
      oldZoomLevel: currentZoomLevel,
    });
  }
}
