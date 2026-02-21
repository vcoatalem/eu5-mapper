import { IConstructibleLocation, ILocationGameData, ILocationIdentifier, ITemporaryLocationData, RoadRecord } from "./types/general";

export class LocationsHelper {
  public static locationHasRoad(
    location: ILocationIdentifier,
    roads: RoadRecord,
  ): boolean {
    return !!roads[location] && roads[location].length > 0; // this works as long as RoadRecord stores both ways mapping
  }

  public static getLocationHarborSuitability(
    locationData: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
  ): number {
    if (!locationData.isCoastal) {
      return -1;
    }
    return locationData.naturalHarborSuitability +
      (Object.values(locationConstructibleData?.buildings ?? {}).reduce((acc, building) => acc + (building?.template?.modifiers?.harborSuitability ?? 0), 0) ?? 0);
  }


  private static getDefaultMaritimePresence(locationData: ILocationGameData): number {
    if (locationData.topography === "ocean") {
      return 0;
    }
    if (locationData.isLake) {
      return 100;
    }
    return 50;
  }

  public static getLocationMaritimePresence(
    locationData: NonNullable<ILocationGameData>,
    locationTemporaryData: ITemporaryLocationData | null,
  ): number {
    if (!locationData.isSea && !locationData.isLake) {
      return -1;
    }
    const defaultMaritimePresence = this.getDefaultMaritimePresence(locationData);
    return locationTemporaryData?.maritimePresence ?? defaultMaritimePresence;
  }
}
