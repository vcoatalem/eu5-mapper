import { ILocationDataMap, ISelectedLocationInfo } from "./types";

export type SelectedLocationsListener = (
  selectedLocations: ISelectedLocationInfo[]
) => void;

export class GameLogicController {
  private selectedLocations: Record<string, ISelectedLocationInfo | null> = {};
  private locationData: ILocationDataMap | null;
  private listeners: SelectedLocationsListener[] = [];

  constructor(locationData: ILocationDataMap | null) {
    this.locationData = locationData;
  }

  public findLocationName(hexColor: string): string {
    if (!this.locationData) {
      console.warn("Location data not available");
      return "??";
    }
    const name = this.locationData[hexColor]?.name;
    if (!name) {
      console.log("could not find name for color", hexColor);
      return "??";
    }
    return name;
  }

  public selectLocation(hexColor: string): boolean {
    const storedLocation = this.selectedLocations[hexColor];
    if (!storedLocation) {
      this.selectedLocations[hexColor] = {
        hexColor,
        name: this.findLocationName(hexColor),
      };
    } else {
      this.selectedLocations[hexColor] = null;
    }
    this.notifyListeners();
    return !storedLocation;
  }

  public getAllSelectedLocations(): ISelectedLocationInfo[] {
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
