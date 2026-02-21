import { gameStateController } from "./gameState.controller";
import { Observable } from "./observable";
import { Subject } from "./subject";
import { ILocationGameData, ILocationIdentifier } from "./types/general";

export type EditMode = "capital" | "road" | "maritime";

/** Slice shape emitted to subscribers (includes derived isModeEnabled). */
export interface IEditModeSlice {
  isModeEnabled: boolean;
  selectedLocation: ILocationIdentifier | null;
}

export interface IChangeCapitalSlice extends IEditModeSlice {
  askConfirmationForLocation?: ILocationIdentifier | null;
}

interface ICapitalSliceBase {
  selectedLocation: ILocationIdentifier | null;
  askConfirmationForLocation?: ILocationIdentifier | null;
}

interface IRoadSliceBase {
  selectedLocation: ILocationIdentifier | null;
}

interface IMaritimeSliceBase {
  selectedLocation: ILocationIdentifier | null;
}

export interface IEditModeState {
  modeEnabled: EditMode | null;
  capital: ICapitalSliceBase;
  road: IRoadSliceBase;
  maritime: IMaritimeSliceBase;
}

const baseCapitalSlice: ICapitalSliceBase = {
  selectedLocation: null,
  askConfirmationForLocation: null,
};

const baseRoadSlice: IRoadSliceBase = {
  selectedLocation: null,
};

const baseMaritimeSlice: IMaritimeSliceBase = {
  selectedLocation: null,
};

class EditModeController extends Observable<IEditModeState> {
  private readonly capitalSliceSubject = new Subject<IChangeCapitalSlice>();
  private readonly roadSliceSubject = new Subject<IEditModeSlice>();
  private readonly maritimeSliceSubject = new Subject<IEditModeSlice>();

  public readonly capitalSlice: Observable<IChangeCapitalSlice> = this.capitalSliceSubject;
  public readonly roadSlice: Observable<IEditModeSlice> = this.roadSliceSubject;
  public readonly maritimeSlice: Observable<IEditModeSlice> = this.maritimeSliceSubject;

  constructor() {
    super();
    this.reset();
  }

  private emitCapitalSlice(): void {
    this.capitalSliceSubject.emit({
      ...this.subject.capital,
      isModeEnabled: this.subject.modeEnabled === "capital",
    });
  }

  private emitRoadSlice(): void {
    this.roadSliceSubject.emit({
      ...this.subject.road,
      isModeEnabled: this.subject.modeEnabled === "road",
    });
  }

  private emitMaritimeSlice(): void {
    this.maritimeSliceSubject.emit({
      ...this.subject.maritime,
      isModeEnabled: this.subject.modeEnabled === "maritime",
    });
  }

  private emitAll(): void {
    this.emitCapitalSlice();
    this.emitRoadSlice();
    this.emitMaritimeSlice();
    this.notifyListeners();
  }

  private setModeEnabled(mode: EditMode | null): void {
    this.subject = { ...this.subject, modeEnabled: mode };
    this.emitAll();
  }

  private setCapitalState(value: ICapitalSliceBase): void {
    this.subject = { ...this.subject, capital: value };
    this.emitCapitalSlice();
    this.notifyListeners();
  }

  private setRoadState(value: IRoadSliceBase): void {
    this.subject = { ...this.subject, road: value };
    this.emitRoadSlice();
    this.notifyListeners();
  }

  private setMaritimeState(value: IMaritimeSliceBase): void {
    this.subject = { ...this.subject, maritime: value };
    this.emitMaritimeSlice();
    this.notifyListeners();
  }

  private deactivateOtherModes(except: EditMode | null): void {
    if (except !== "capital") this.setCapitalState({ ...baseCapitalSlice });
    if (except !== "road") this.setRoadState({ ...baseRoadSlice });
    if (except !== "maritime") this.setMaritimeState({ ...baseMaritimeSlice });
  }

  public toggleCapitalMode(): void {
    if (this.subject.modeEnabled === "capital") {
      this.setModeEnabled(null);
      this.setCapitalState({ ...baseCapitalSlice });
      return;
    }
    this.deactivateOtherModes("capital");
    this.setModeEnabled("capital");
    this.setCapitalState({ ...baseCapitalSlice });
  }

  public toggleRoadMode(): void {
    if (this.subject.modeEnabled === "road") {
      this.setModeEnabled(null);
      this.setRoadState({ ...baseRoadSlice });
      return;
    }
    this.deactivateOtherModes("road");
    this.setModeEnabled("road");
    this.setRoadState({ ...baseRoadSlice });
  }

  public toggleMaritimeMode(): void {
    if (this.subject.modeEnabled === "maritime") {
      this.setModeEnabled(null);
      this.setMaritimeState({ ...baseMaritimeSlice });
      return;
    }
    this.deactivateOtherModes("maritime");
    this.setModeEnabled("maritime");
    this.setMaritimeState({ ...baseMaritimeSlice });
  }

  public askForConfirmation(location: ILocationIdentifier): void {
    this.deactivateOtherModes("capital");
    this.setCapitalState({
      ...this.subject.capital,
      askConfirmationForLocation: location,
    });
  }

  public confirmChangeCapital(): void {
    const loc = this.subject.capital.askConfirmationForLocation;
    if (this.subject.modeEnabled !== "capital" || !loc) return;
    gameStateController.changeCapital(loc);
    this.setModeEnabled(null);
    this.setCapitalState({ ...baseCapitalSlice });
  }

  public selectLocationForBuildingRoad(location: ILocationIdentifier): void {
    if (this.subject.modeEnabled !== "road") return;
    this.setRoadState({ ...this.subject.road, selectedLocation: location });
  }

  public selectLocationForEditing(location: ILocationIdentifier): void {
    if (this.subject.modeEnabled !== "maritime") return;
    this.setMaritimeState({ ...this.subject.maritime, selectedLocation: location });
  }

  public clearLocationForEditing(): void {
    if (this.subject.modeEnabled !== "maritime") return;
    this.setMaritimeState({ ...this.subject.maritime, selectedLocation: null });
  }

  public init(): void {
    this.subject = {
      modeEnabled: null,
      capital: { ...baseCapitalSlice },
      road: { ...baseRoadSlice },
      maritime: { ...baseMaritimeSlice },
    };
    this.emitAll();
  }

  public reset(): void {
    this.subject = {
      modeEnabled: null,
      capital: { ...baseCapitalSlice },
      road: { ...baseRoadSlice },
      maritime: { ...baseMaritimeSlice },
    };
    this.emitAll();
  }

  public isLocationEligibleForCapital(location: ILocationGameData): boolean {
    return !!location.ownable && !location.isSea && !location.isLake;
  }

  public isLocationEligibleForRoad(location: ILocationGameData): boolean {
    return !!location.ownable && !location.isSea && !location.isLake;
  }

  public isLocationEligibleForMaritime(location: ILocationGameData): boolean {
    return !!location && (!!location.isSea || !!location.isLake);
  }
}

export const editModeController = new EditModeController();
