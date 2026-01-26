import {
  ILocationIdentifier,
  ILocationDataMap,
  ILocationIdentifierMap,
} from "./types";

export type SelectedLocationsListener = (
  selectedLocations: ILocationIdentifier[]
) => void;

type LocationName = string;

export class GameLogicController {
  private selectedLocations: Record<LocationName, ILocationIdentifier> = {};
  private locationIdentifierMap: ILocationIdentifierMap = {};
  private locationData: ILocationDataMap | null; // surely we will need this as well ?
  private listeners: SelectedLocationsListener[] = [];

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
    const storedLocation = this.selectedLocations[locationName];
    if (!storedLocation) {
      this.selectedLocations[locationName] = locationName;
    } else {
      delete this.selectedLocations[locationName];
    }
    this.notifyListeners();
    return !storedLocation;
  }

  public getAllSelectedLocations(): ILocationIdentifier[] {
    return Object.entries(this.selectedLocations)
      .map(([_, location]) => location)
      .filter((location) => !!location);
  }

  public subscribe(listener: SelectedLocationsListener): void {
    this.listeners.push(listener);
  }

  public unsubscribe(listener: SelectedLocationsListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    const currentSelectedLocations = this.getAllSelectedLocations();
    this.listeners.forEach((listener) => {
      listener(currentSelectedLocations);
    });
  }
}
