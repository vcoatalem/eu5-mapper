import { IConstructibleLocation, ILocationGameData, ILocationIdentifier, RoadRecord } from "./types/general";

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
}
