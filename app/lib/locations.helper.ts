import { ILocationIdentifier, RoadRecord } from "./types/general";

export class LocationsHelper {
  public static locationHasRoad(
    location: ILocationIdentifier,
    roads: RoadRecord,
  ): boolean {
    return !!roads[location] && roads[location].length > 0; // this works as long as RoadRecord stores both ways mapping
  }
}
