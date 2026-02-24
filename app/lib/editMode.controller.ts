import { gameStateController } from "./gameState.controller";
import { Observable } from "./observable";
import { Subject } from "./subject";
import { ILocationGameData, ILocationIdentifier } from "./types/general";

export type EditMode = "acquire" | "capital" | "road" | "maritime";
const defaultMode: EditMode = "acquire";

export interface IEditModeSlice {
  isModeEnabled: boolean;
  selectedLocation: ILocationIdentifier | null;
}
export interface IAcquireLocationSlice extends IEditModeSlice {
  brushSize: keyof ILocationGameData["hierarchy"] | 'location';
}

export interface IChangeCapitalSlice extends IEditModeSlice {
  askConfirmationForLocation?: ILocationIdentifier | null;
}


type Base<T extends IEditModeSlice> = Omit<T, 'isModeEnabled'>;

export interface IEditModeState {
  modeEnabled: EditMode;
  capital: Base<IChangeCapitalSlice>;
  road: Base<IEditModeSlice>;
  maritime: Base<IEditModeSlice>;
  acquireLocations: Base<IAcquireLocationSlice>;
}

const baseAcquireLocationsSlice: Base<IAcquireLocationSlice> = {
  selectedLocation: null,
  brushSize: 'location',

}

const baseCapitalSlice: Base<IChangeCapitalSlice> = {
  selectedLocation: null,
  askConfirmationForLocation: null,
};

const baseRoadSlice: Base<IEditModeSlice> = {
  selectedLocation: null,
};

const baseMaritimeSlice: Base<IEditModeSlice> = {
  selectedLocation: null,
};

class EditModeController extends Observable<IEditModeState> {
  private readonly capitalSliceSubject = new Subject<IChangeCapitalSlice>();
  private readonly roadSliceSubject = new Subject<IEditModeSlice>();
  private readonly maritimeSliceSubject = new Subject<IEditModeSlice>();
  private readonly acquireLocationSliceSubject = new Subject<IAcquireLocationSlice>();

  public readonly capitalSlice: Observable<IChangeCapitalSlice> = this.capitalSliceSubject;
  public readonly roadSlice: Observable<IEditModeSlice> = this.roadSliceSubject;
  public readonly maritimeSlice: Observable<IEditModeSlice> = this.maritimeSliceSubject;
  public readonly acquireLocationSlice: Observable<IAcquireLocationSlice> = this.acquireLocationSliceSubject;

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

   private emitAcquireLocationSlice(): void {
    this.acquireLocationSliceSubject.emit({
      ...this.subject.acquireLocations,
      isModeEnabled: this.subject.modeEnabled === "acquire",
    });
  }

  private emitAll(): void {
    this.emitCapitalSlice();
    this.emitRoadSlice();
    this.emitMaritimeSlice();
    this.emitAcquireLocationSlice();
    this.notifyListeners();
  }

  private setModeEnabled(mode: EditMode): void {
    this.subject = { ...this.subject, modeEnabled: mode };
    this.emitAll();
  }

  private setCapitalState(value: Base<IChangeCapitalSlice>): void {
    this.subject = { ...this.subject, capital: value };
    this.emitCapitalSlice();
    this.notifyListeners();
  }

  private setRoadState(value: Base<IEditModeSlice>): void {
    this.subject = { ...this.subject, road: value };
    this.emitRoadSlice();
    this.notifyListeners();
  }

  private setMaritimeState(value: Base<IEditModeSlice>): void {
    this.subject = { ...this.subject, maritime: value };
    this.emitMaritimeSlice();
    this.notifyListeners();
  }

  private setAcquireLocationState(value: Base<IAcquireLocationSlice>): void {
    this.subject = { ...this.subject, acquireLocations: value };
    this.emitAcquireLocationSlice();
    this.notifyListeners();
  }

  private deactivateOtherModes(except: EditMode): void {
    if (except !== "capital") this.setCapitalState({ ...baseCapitalSlice });
    if (except !== "road") this.setRoadState({ ...baseRoadSlice });
    if (except !== "maritime") this.setMaritimeState({ ...baseMaritimeSlice });
    if (except !== "acquire") this.setAcquireLocationState({ ...baseAcquireLocationsSlice });
  }


  private deactivateIfEnabled(mode: EditMode): boolean {
    if (this.subject.modeEnabled === mode) {
      this.setModeEnabled(defaultMode);
      return true;
    }
    this.deactivateOtherModes(mode);
    return false;
  }
  
  public enableAcquireMode(): void {
    this.deactivateOtherModes("acquire");
    this.setModeEnabled("acquire");
/*     this.setAcquireLocationState({ ...baseAcquireLocationsSlice }); */
  }

  public toggleCapitalMode(): void {
    const deactivated = this.deactivateIfEnabled("capital");
    if (deactivated) return;
    this.setModeEnabled("capital");
    this.setCapitalState({ ...baseCapitalSlice });
  }

  public toggleRoadMode(): void {
    const deactivated = this.deactivateIfEnabled("road");
    if (deactivated) return;
    this.setModeEnabled("road");
    this.setRoadState({ ...baseRoadSlice });
  }

  public toggleMaritimeMode(): void {
    const deactivated = this.deactivateIfEnabled("maritime");
    if (deactivated) return;
    this.setModeEnabled("maritime");
    this.setMaritimeState({ ...baseMaritimeSlice });
  }

  public askForConfirmation(mode: EditMode, location: ILocationIdentifier): void {
    switch (mode) {
      case "capital":
        this.setCapitalState({ ...this.subject.capital, askConfirmationForLocation: location });
        break;
      default:
        // no handling for other modes
        return;
    }
  }

  public confirmChangeCapital(): void {
    const loc = this.subject.capital.askConfirmationForLocation;
    if (this.subject.modeEnabled !== "capital" || !loc) return;
    gameStateController.changeCapital(loc);
    this.setModeEnabled(defaultMode);
    this.setCapitalState({ ...baseCapitalSlice });
  }

  public selectLocation(mode: EditMode, location: ILocationIdentifier): void {
    switch (mode) {
      case "maritime":
        this.setMaritimeState({ ...this.subject.maritime, selectedLocation: location });
        break;
      case "road":
        this.setRoadState({ ...this.subject.road, selectedLocation: location });
        break;
      case "capital":
        this.setCapitalState({ ...this.subject.capital, selectedLocation: location });
        break;
      default:
        // no handling for other modes
        return;
    }
  }

  public clearLocation(mode: EditMode): void {
    switch (mode) {
      case "maritime":
        this.setMaritimeState({ ...this.subject.maritime, selectedLocation: null });
        break;
      case "road":
        this.setRoadState({ ...this.subject.road, selectedLocation: null });
        break;
      case "capital":
        this.setCapitalState({ ...this.subject.capital, selectedLocation: null });
        break;
      default:
        // no handling for other modes
        return;
    }
  }

  public setBrushSize(mode: EditMode, size: 'location' | 'province' | 'area'): void {
    switch (mode) {
      case "acquire":
        this.setAcquireLocationState({ ...this.subject.acquireLocations, brushSize: size });
        break;
      default:
        // no handling for other modes
        return;
    }
  }

  public init(): void {
   this.reset();
  }

  public reset(): void {
    this.subject = {
      modeEnabled: defaultMode,
      capital: { ...baseCapitalSlice },
      road: { ...baseRoadSlice },
      maritime: { ...baseMaritimeSlice },
      acquireLocations: { ...baseAcquireLocationsSlice },
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
