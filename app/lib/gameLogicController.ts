import {
  ILocationIdentifier,
  ILocationDataMap,
  ILocationIdentifierMap,
  IConstructibleLocation,
} from "./types";

export type OwnedLocationsListener = (
  ownedLocations: Record<ILocationIdentifier, IConstructibleLocation>
) => void;

export class GameLogicController {
  private ownedLocations: Record<ILocationIdentifier, IConstructibleLocation> =
    {};
  private locationIdentifierMap: ILocationIdentifierMap = {};
  private locationData: ILocationDataMap | null; // surely we will need this as well ?
  private listeners: OwnedLocationsListener[] = [];

  constructor(
    locationData: ILocationDataMap | null,
    locationIdentifierMap: ILocationIdentifierMap
  ) {
    this.locationData = locationData;
    this.locationIdentifierMap = locationIdentifierMap;
  }

  public findLocationName(hexColor: string): string {
    if (!this.locationIdentifierMap) {
      console.warn("Location data not available");
      return "??";
    }
    const name = this.locationIdentifierMap[hexColor];
    if (!name) {
      console.log("could not find name for color", hexColor);
      return "??";
    }
    return name;
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
