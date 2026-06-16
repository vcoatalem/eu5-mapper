import { Observable } from "@/app/lib/observable";
import { LayerName, ALL_LAYER_NAMES } from "@/app/lib/types/coordinateSpaces";
import { CameraController, zoomLevels } from "@/app/lib/cameraController";
import { DETAIL_TILE_MIN_ZOOM } from "@/app/components/worldMap.config";

export interface ILayerVisibilityState {
  layerVisibility: Partial<
    Record<
      LayerName,
      { set: "visible" | "hidden"; forced?: "visible" | "hidden" }
    >
  >;
}

const KNOWN_LAYER_NAMES = new Set<LayerName>(ALL_LAYER_NAMES);

const localStorageKey = "layerVisibility";

export class LayerVisibilityModel extends Observable<ILayerVisibilityState> {
  public constructor() {
    super();
    this.loadFromLocalStorage();
  }

  public init(camera: CameraController) {
    camera.subscribe(({ zoomLevel, oldZoomLevel }) => {
      let changed = false;

      // Border: auto-hide below zoomLevels.normal
      if (zoomLevel < zoomLevels.normal && oldZoomLevel >= zoomLevels.normal) {
        this.subject.layerVisibility["border"] = {
          ...(this.subject.layerVisibility["border"] ?? { set: "visible" }),
          forced: "hidden",
        };
        changed = true;
      } else if (
        zoomLevel >= zoomLevels.normal &&
        oldZoomLevel < zoomLevels.normal
      ) {
        this.subject.layerVisibility["border"] = {
          ...(this.subject.layerVisibility["border"] ?? { set: "visible" }),
          forced: undefined,
        };
        changed = true;
      }

      // Roads + constructibles: auto-hide below DETAIL_TILE_MIN_ZOOM
      if (
        zoomLevel < DETAIL_TILE_MIN_ZOOM &&
        oldZoomLevel >= DETAIL_TILE_MIN_ZOOM
      ) {
        this.subject.layerVisibility["roads"] = {
          ...(this.subject.layerVisibility["roads"] ?? { set: "visible" }),
          forced: "hidden",
        };
        this.subject.layerVisibility["constructibles"] = {
          ...(this.subject.layerVisibility["constructibles"] ?? {
            set: "visible",
          }),
          forced: "hidden",
        };
        changed = true;
      } else if (
        zoomLevel >= DETAIL_TILE_MIN_ZOOM &&
        oldZoomLevel < DETAIL_TILE_MIN_ZOOM
      ) {
        this.subject.layerVisibility["roads"] = {
          ...(this.subject.layerVisibility["roads"] ?? { set: "visible" }),
          forced: undefined,
        };
        this.subject.layerVisibility["constructibles"] = {
          ...(this.subject.layerVisibility["constructibles"] ?? {
            set: "visible",
          }),
          forced: undefined,
        };
        changed = true;
      }

      if (changed) this.notifyListeners();
    });
  }

  public toggleLayerVisibility(layer: LayerName) {
    const currentVisibility = this.subject.layerVisibility[layer];
    if (!currentVisibility) return;
    this.subject.layerVisibility[layer] = {
      ...currentVisibility,
      set: currentVisibility.set === "visible" ? "hidden" : "visible",
    };
    this.notifyListeners();
    this.saveToLocalStorage();
  }

  public saveToLocalStorage() {
    localStorage.setItem(
      localStorageKey,
      JSON.stringify(this.subject.layerVisibility),
    );
  }

  public loadFromLocalStorage() {
    const stored = localStorage.getItem(localStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Object.keys(parsed).some((k) => !KNOWN_LAYER_NAMES.has(k as LayerName))) {
          localStorage.removeItem(localStorageKey);
        } else {
          this.subject = { layerVisibility: parsed };
          this.notifyListeners();
          return;
        }
      } catch {
        // JSON parse failed — fall through to defaults
      }
    }
    this.subject = {
      layerVisibility: {
        border: { set: "visible", forced: "visible" },
        roads: { set: "visible" },
        constructibles: { set: "visible" },
      },
    };
    this.notifyListeners();
  }
}

export const getLayerVisibilityClass = (
  layerName: LayerName,
  state: ILayerVisibilityState,
): "visible" | "hidden" => {
  if (!(layerName in state.layerVisibility)) return "visible";
  const visibility = state.layerVisibility[layerName];
  if (visibility === undefined) return "visible";
  return (visibility.forced ?? visibility.set ?? "visible") as
    | "visible"
    | "hidden";
};
