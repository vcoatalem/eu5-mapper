import { Observable } from "./observable";
import {
  ILocationIdentifier,
  IConstructibleLocation,
  IGameData,
} from "./types";

export class GameLogicController extends Observable<
  Record<ILocationIdentifier, IConstructibleLocation>
> {
  private ownedLocations: Record<ILocationIdentifier, IConstructibleLocation> =
    {};

  private gameData: IGameData | null = null;

  constructor(gameData: IGameData) {
    super();
    this.gameData = gameData;
  }

  public findLocationName(hexColor: string): string {
    const name = this.gameData?.colorToNameMap[hexColor];
    if (!name) {
      console.log("could not find name for color", hexColor);
      return "??";
    }
    return name ?? "??";
  }

  public selectLocation(locationName: string): boolean {
    const storedLocation = this.ownedLocations[locationName];
    if (!storedLocation) {
      this.ownedLocations[locationName] = {
        level: "rural",
        buildings: [],
      };
    } else {
      delete this.ownedLocations[locationName];
    }
    this.notifyListeners(this.ownedLocations);
    return !storedLocation;
  }

  public getAllSelectedLocations(): Record<
    ILocationIdentifier,
    IConstructibleLocation
  > {
    return this.ownedLocations;
  }
}
