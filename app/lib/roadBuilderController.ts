import { Observable } from "./observable";
import { ILocationIdentifier } from "./types/general";

interface IRoadBuilderState {
  isBuildingModeEnabled: boolean;
  isBuildingAtLocation: ILocationIdentifier | null;
}

export class RoadBuilderController extends Observable<IRoadBuilderState> {
  private baseState: IRoadBuilderState = {
    isBuildingModeEnabled: false,
    isBuildingAtLocation: null,
  };
  constructor() {
    super();
    this.init();
  }

  public toggleBuildingMode(): void {
    this.subject = {
      ...this.subject,
      isBuildingModeEnabled: !this.subject.isBuildingModeEnabled,
    };
    this.notifyListeners();
  }

  public selectLocationForBuildingRoad(
    locationName: ILocationIdentifier,
  ): void {
    if (!this.subject.isBuildingModeEnabled) return;
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
}

export const roadBuilderController = new RoadBuilderController();
