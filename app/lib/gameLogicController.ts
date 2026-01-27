import {
  ILocationIdentifier,
  ILocationDataMap,
  ILocationIdentifierMap,
  IConstructibleLocation,
  IGameData,
} from "./types";

export type OwnedLocationsListener = (
  ownedLocations: Record<ILocationIdentifier, IConstructibleLocation>,
) => void;

export class GameLogicController {
  private ownedLocations: Record<ILocationIdentifier, IConstructibleLocation> =
    {};
  private gameData: IGameData | null = null;
  private listeners: OwnedLocationsListener[] = [];

  constructor(gameData: IGameData) {
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
    this.notifyListeners();
    return !storedLocation;
  }

  public getAllSelectedLocations(): Record<
    ILocationIdentifier,
    IConstructibleLocation
  > {
    return this.ownedLocations;
  }

  public subscribe(listener: OwnedLocationsListener): void {
    this.listeners.push(listener);
  }

  public unsubscribe(listener: OwnedLocationsListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.ownedLocations);
    });
  }
}
