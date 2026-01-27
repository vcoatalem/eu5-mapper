import { Observable } from "./observable";

const zoomSteps = [0.1, 0.3, 0.7, 1, 1.5, 3, 5];

export type ZoomListener = (zoom: {
  zoomLevel: number;
  zoomIndex: number;
}) => void;

export class ZoomController extends Observable<{
  zoomLevel: number;
  zoomIndex: number;
}> {
  private currentZoomIndex: number;

  constructor() {
    super();
    this.currentZoomIndex = zoomSteps.indexOf(1);
  }

  public zoomIn(): void {
    if (this.currentZoomIndex < zoomSteps.length - 1) {
      this.currentZoomIndex++;
    }

    this.notifyListeners({
      zoomIndex: this.currentZoomIndex,
      zoomLevel: zoomSteps[this.currentZoomIndex],
    });
  }

  public zoomOut(): void {
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
    }

    this.notifyListeners({
      zoomIndex: this.currentZoomIndex,
      zoomLevel: zoomSteps[this.currentZoomIndex],
    });
  }
}
