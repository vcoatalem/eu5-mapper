import { ILocationDataMap, ISelectedLocationInfo } from "./types";
import { GameDataRegistry } from "./gameDataRegistry";

export type SelectedLocationsListener = (
  selectedLocations: ISelectedLocationInfo[]
) => void;

export class GameLogicController {
  private selectedLocations: Record<string, ISelectedLocationInfo | null> = {};
  private registry: GameDataRegistry;
  private listeners: SelectedLocationsListener[] = [];

  constructor() {
    this.registry = GameDataRegistry.getInstance();
  }

  public findLocationName(hexColor: string): string {
    const mappingData = this.registry.getLocationData();
    if (!mappingData) {
      console.warn("Location data not available in registry");
      return "??";
    }
    const name = mappingData[hexColor]?.name;
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
