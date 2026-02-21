import { gameStateController } from "./gameState.controller";
import { Observable } from "./observable";
import { ILocationGameData, ILocationIdentifier } from "./types/general";

export interface IChangeCapitalState {
  isModeEnabled: boolean;
  needConfirmationForLocation: ILocationIdentifier | null;
}

const baseState: IChangeCapitalState = {
  isModeEnabled: false,
  needConfirmationForLocation: null,
};

class ChangeCapitalController extends Observable<IChangeCapitalState> {
  constructor() {
    super();
    this.subject = baseState;
  }

  public askForConfirmation(location: ILocationIdentifier): void {
    this.subject = {
      isModeEnabled: true,
      needConfirmationForLocation: location,
    };
    this.notifyListeners();
  }

  public confirmChangeCapital(): void {
    if (
      !this.subject.isModeEnabled ||
      !this.subject.needConfirmationForLocation
    )
      return;
    gameStateController.changeCapital(this.subject.needConfirmationForLocation);
    this.subject = baseState;
    this.notifyListeners();
  }

  public toggleMode(): void {
    this.subject = {
      isModeEnabled: !this.subject.isModeEnabled,
      needConfirmationForLocation: null,
    };
    this.notifyListeners();
  }

  public init(): void {
    this.subject = baseState;
    this.notifyListeners();
  }

  public isLocationEligibleForMode(location: ILocationGameData): boolean {
    return !!location.ownable && !location.isSea && !location.isLake;
  }
}

export const changeCapitalController = new ChangeCapitalController();
