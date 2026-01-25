import { ILocationDataMap, ISelectedLocationInfo } from "./types";

export class GameLogicController {
  private selectedLocations: Record<string, ISelectedLocationInfo | null> = {};

  public findLocationName(
    hexColor: string,
    mappingData: ILocationDataMap
  ): string {
    const name = mappingData[hexColor].name;
    if (!name) {
      console.log("could not find name for color", hexColor);
      return "??";
    }
    return name;
  }

  public selectLocation(
    hexColor: string,
    mappingData: ILocationDataMap,
    coordinates: Array<{ x: number; y: number }>
  ): boolean {
    const storedLocation = this.selectedLocations[hexColor];
    if (!storedLocation) {
      this.selectedLocations[hexColor] = {
        hexColor,
        coordinates,
        name: this.findLocationName(hexColor, mappingData),
      };

      console.log(
        "new selected locations state:",
        JSON.stringify(Object.entries(this.selectedLocations))
      );
      return true;
    } else {
      this.selectedLocations[hexColor] = null;
      console.log(
        "new selected locations state:",
        JSON.stringify(Object.entries(this.selectedLocations))
      );
      return false;
    }
  }

  public getAllSelectedLocations(): ISelectedLocationInfo[] {
    return Object.entries(this.selectedLocations)
      .map(([_, location]) => location)
      .filter((location) => !!location);
  }
}
