import { Observable } from "@/app/lib/observable";
import { CanvasName } from "@/app/lib/types/rendering";
import { zoomLevels, cameraController } from "@/app/lib/cameraController";

interface ILayerVisibilityState {
  layerVisibility: Partial<
    Record<
      CanvasName,
      { set: "visible" | "hidden"; forced?: "visible" | "hidden" }
    >
  >;
}

class LayerVisibilityController extends Observable<ILayerVisibilityState> {
  private readonly localStorageKey = "layerVisibility";

  public constructor() {
    super();
    this.loadFromLocalStorage();
  }

  public init() {
    cameraController.subscribe(({ zoomLevel, oldZoomLevel }) => {
      console.log("[LayerVisibilityController] zoom level changed", {
        zoomLevel,
        oldZoomLevel,
      }); // Debug log
      if (zoomLevel < zoomLevels.normal && oldZoomLevel >= zoomLevels.normal) {
        this.subject.layerVisibility[CanvasName.border] = {
          ...(this.subject.layerVisibility[CanvasName.border] ?? {
            set: "visible",
          }),
          forced: "hidden",
        };
        this.notifyListeners();
      } else if (
        zoomLevel >= zoomLevels.normal &&
        oldZoomLevel < zoomLevels.normal
      ) {
        this.subject.layerVisibility[CanvasName.border] = {
          ...(this.subject.layerVisibility[CanvasName.border] ?? {
            set: "visible",
          }),
          forced: undefined,
        };
        this.notifyListeners();
      }
    });
  }

  public toggleLayerVisibility(layer: CanvasName) {
    const currentVisibility = this.subject.layerVisibility[layer];
    if (!currentVisibility) {
      return;
    }
    this.subject.layerVisibility[layer] = {
      ...currentVisibility,
      set: currentVisibility.set === "visible" ? "hidden" : "visible",
    };
    this.notifyListeners();
    this.saveToLocalStorage();
  }

  public saveToLocalStorage() {
    localStorage.setItem(
      this.localStorageKey,
      JSON.stringify(this.subject.layerVisibility),
    );
  }

  public loadFromLocalStorage() {
    const stored = localStorage.getItem(this.localStorageKey);
    let initialized = false;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.subject = {
          layerVisibility: parsed,
        };
        initialized = true;
      } catch (error) {
        console.error(
          "Failed to parse layer visibility from localStorage",
          error,
        );
      }
    }
    if (!initialized) {
      this.subject = {
        layerVisibility: {
          [CanvasName.border]: {
            set: "visible",
            forced: "visible",
          },
          [CanvasName.roadsDrawing]: {
            set: "visible",
          },
          [CanvasName.constructiblesDrawing]: {
            set: "visible",
          },
        },
      };
    }
    this.notifyListeners();
  }
}

export const getLayerVisibilityClass = (
  layerName: CanvasName,
  state: ILayerVisibilityState,
) => {
  if (!(layerName in state.layerVisibility)) {
    return "visible";
  }

  const visibility = state.layerVisibility[layerName];
  if (visibility === undefined) return "visible";
  return visibility.forced ?? visibility.set ?? "visible";
};

export const layerVisibilityController = new LayerVisibilityController();
