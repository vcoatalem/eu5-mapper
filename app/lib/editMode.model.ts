import { ILocationHierarchy } from "@/app/lib/types/locationHierarchy";
import { GameStateModel } from "./gameState.model";
import { Observable } from "./observable";
import { LocationIdentifier } from "./types/general";

export type EditMode = "acquire" | "capital" | "road" | "maritime";
const defaultMode: EditMode = "acquire";

export const ACQUIRE_BRUSH_SIZES = ["location", "province", "area"] as const;
export type AcquireBrushSize = (typeof ACQUIRE_BRUSH_SIZES)[number];

type BrushSize = keyof ILocationHierarchy | "location";

/** Per-mode state stored in IEditModeState (no isModeEnabled). */
type LocationSelection = { selectedLocation: LocationIdentifier | null };

export interface IEditModeState {
  modeEnabled: EditMode;
  capital: LocationSelection & {
    askConfirmationForLocation?: LocationIdentifier | null;
  };
  road: LocationSelection;
  maritime: LocationSelection;
  acquireLocations: LocationSelection & { brushSize: BrushSize };
}

export interface IEditModeSlice extends LocationSelection {
  isModeEnabled: boolean;
}
export interface IAcquireLocationSlice extends IEditModeSlice {
  brushSize: BrushSize;
}
export interface IChangeCapitalSlice extends IEditModeSlice {
  askConfirmationForLocation?: LocationIdentifier | null;
}

const baseRoad: LocationSelection = { selectedLocation: null };
const baseMaritime: LocationSelection = { selectedLocation: null };
const baseCapital: IEditModeState["capital"] = {
  selectedLocation: null,
  askConfirmationForLocation: null,
};
const baseAcquire: IEditModeState["acquireLocations"] = {
  selectedLocation: null,
  brushSize: "location",
};

export class EditModeModel extends Observable<IEditModeState> {
  constructor(private gameState: GameStateModel) {
    super();
    this.reset();
  }

  private deactivateOtherModes(except: EditMode): void {
    if (except !== "capital")
      this.subject = { ...this.subject, capital: { ...baseCapital } };
    if (except !== "road")
      this.subject = { ...this.subject, road: { ...baseRoad } };
    if (except !== "maritime")
      this.subject = { ...this.subject, maritime: { ...baseMaritime } };
    if (except !== "acquire")
      this.subject = { ...this.subject, acquireLocations: { ...baseAcquire } };
  }

  private deactivateIfEnabled(mode: EditMode): boolean {
    if (this.subject.modeEnabled === mode) {
      switch (mode) {
        case "road":
          this.subject = {
            ...this.subject,
            modeEnabled: defaultMode,
            road: { ...baseRoad },
          };
          break;
        case "maritime":
          this.subject = {
            ...this.subject,
            modeEnabled: defaultMode,
            maritime: { ...baseMaritime },
          };
          break;
        case "capital":
          this.subject = {
            ...this.subject,
            modeEnabled: defaultMode,
            capital: { ...baseCapital },
          };
          break;
        case "acquire":
          this.subject = {
            ...this.subject,
            modeEnabled: defaultMode,
            acquireLocations: { ...baseAcquire },
          };
          break;
      }
      this.notifyListeners();
      return true;
    }
    this.deactivateOtherModes(mode);
    return false;
  }

  public enableAcquireMode(): void {
    this.deactivateOtherModes("acquire");
    this.subject = { ...this.subject, modeEnabled: "acquire" };
    this.notifyListeners();
  }

  public toggleCapitalMode(): void {
    const deactivated = this.deactivateIfEnabled("capital");
    if (deactivated) return;
    this.subject = { ...this.subject, modeEnabled: "capital" };
    this.notifyListeners();
  }

  public toggleRoadMode(): void {
    const deactivated = this.deactivateIfEnabled("road");
    if (deactivated) return;
    this.subject = { ...this.subject, modeEnabled: "road" };
    this.notifyListeners();
  }

  public toggleMaritimeMode(): void {
    const deactivated = this.deactivateIfEnabled("maritime");
    if (deactivated) return;
    this.subject = { ...this.subject, modeEnabled: "maritime" };
    this.notifyListeners();
  }

  public askForConfirmation(
    mode: EditMode,
    location: LocationIdentifier,
  ): void {
    switch (mode) {
      case "capital":
        this.subject = {
          ...this.subject,
          capital: {
            ...this.subject.capital,
            askConfirmationForLocation: location,
          },
        };
        this.notifyListeners();
        break;
      default:
        return;
    }
  }

  public confirmChangeCapital(): void {
    const loc = this.subject.capital.askConfirmationForLocation;
    if (this.subject.modeEnabled !== "capital" || !loc) return;
    this.gameState.changeCapital(loc);
    this.subject = {
      ...this.subject,
      modeEnabled: defaultMode,
      capital: { ...baseCapital },
    };
    this.notifyListeners();
  }

  public selectLocation(mode: EditMode, location: LocationIdentifier): void {
    switch (mode) {
      case "maritime":
        this.subject = {
          ...this.subject,
          maritime: { ...this.subject.maritime, selectedLocation: location },
        };
        break;
      case "road":
        this.subject = {
          ...this.subject,
          road: { ...this.subject.road, selectedLocation: location },
        };
        break;
      case "capital":
        this.subject = {
          ...this.subject,
          capital: { ...this.subject.capital, selectedLocation: location },
        };
        break;
      default:
        return;
    }
    this.notifyListeners();
  }

  public clearLocation(mode: EditMode): void {
    switch (mode) {
      case "maritime":
        this.subject = {
          ...this.subject,
          maritime: { ...this.subject.maritime, selectedLocation: null },
        };
        break;
      case "road":
        this.subject = {
          ...this.subject,
          road: { ...this.subject.road, selectedLocation: null },
        };
        break;
      case "capital":
        this.subject = {
          ...this.subject,
          capital: { ...this.subject.capital, selectedLocation: null },
        };
        break;
      default:
        return;
    }
    this.notifyListeners();
  }

  public setBrushSize(
    mode: EditMode,
    size: AcquireBrushSize,
  ): void {
    switch (mode) {
      case "acquire":
        this.subject = {
          ...this.subject,
          acquireLocations: {
            ...this.subject.acquireLocations,
            brushSize: size,
          },
        };
        break;
      default:
        return;
    }
    this.notifyListeners();
  }

  public init(): void {
    this.reset();
  }

  public reset(): void {
    this.subject = {
      modeEnabled: defaultMode,
      capital: { ...baseCapital },
      road: { ...baseRoad },
      maritime: { ...baseMaritime },
      acquireLocations: { ...baseAcquire },
    };
    this.notifyListeners();
  }
}

export function roadSliceFromState(state: IEditModeState): IEditModeSlice {
  return { ...state.road, isModeEnabled: state.modeEnabled === "road" };
}
export function maritimeSliceFromState(state: IEditModeState): IEditModeSlice {
  return { ...state.maritime, isModeEnabled: state.modeEnabled === "maritime" };
}
export function capitalSliceFromState(
  state: IEditModeState,
): IChangeCapitalSlice {
  return { ...state.capital, isModeEnabled: state.modeEnabled === "capital" };
}
export function acquireLocationSliceFromState(
  state: IEditModeState,
): IAcquireLocationSlice {
  return {
    ...state.acquireLocations,
    isModeEnabled: state.modeEnabled === "acquire",
  };
}
