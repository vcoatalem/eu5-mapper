import { Observable } from "@/app/lib/observable";
import { ILocationGameData, ILocationIdentifier } from "@/app/lib/types/general";


export interface IMaritimePresenceEditState {
  isModeEnabled: boolean;
  location: ILocationIdentifier | null;
}

const baseState: IMaritimePresenceEditState = {
  isModeEnabled: false,
  location: null,
};

class MaritimePresenceEditController extends Observable<IMaritimePresenceEditState> {

  constructor() {
    super();
    this.subject = baseState;
  }
  public toggleMode(): void {
    this.subject = {
      isModeEnabled: !this.subject.isModeEnabled,
      location: null,
    };
    this.notifyListeners();
  }

  public selectLocationForEditing(location: ILocationIdentifier): void {
    if (!this.subject.isModeEnabled) return;
    this.subject = {
      isModeEnabled: true,
      location,
    };
    this.notifyListeners();
  }

  public clearLocationForEditing(): void {
    this.subject = {
      isModeEnabled: true,
      location: null,
    };
    this.notifyListeners();
  }

  public init(): void {
    this.subject = { ...baseState };
    this.notifyListeners();
  }

  public isLocationEligibleForMode(location: ILocationGameData): boolean {
    return (!!location && (!!location.isSea || !!location.isLake));
  }
}

export const maritimePresenceEditController = new MaritimePresenceEditController();