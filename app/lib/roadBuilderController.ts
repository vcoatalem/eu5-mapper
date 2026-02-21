import { Observable } from "./observable";
import { ILocationGameData, ILocationIdentifier } from "./types/general";

interface IRoadBuilderState {
  isModeEnabled: boolean;
  isBuildingAtLocation: ILocationIdentifier | null;
}

class RoadBuilderController extends Observable<IRoadBuilderState> {
  private baseState: IRoadBuilderState = {
    isModeEnabled: false,
    isBuildingAtLocation: null,
  };
  constructor() {
    super();
    this.init();
  }

  public toggleMode(): void {
    this.subject = {
      isBuildingAtLocation: null,
      isModeEnabled: !this.subject.isModeEnabled,
    };
    this.notifyListeners();
  }

  public selectLocationForBuildingRoad(
    locationName: ILocationIdentifier,
  ): void {
    if (!this.subject.isModeEnabled) return;
    this.subject = {
      ...this.subject,
      isBuildingAtLocation: locationName,
    };
    this.notifyListeners();
  }

  public init(): void {
    this.subject = { ...this.baseState };
    this.notifyListeners();
  }

  public isLocationEligibleForMode(location: ILocationGameData): boolean {
    return !!location.ownable && !location.isSea && !location.isLake;
  }
}

export const roadBuilderController = new RoadBuilderController();
