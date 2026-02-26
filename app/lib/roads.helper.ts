
import { asRoadKey, RoadKey, RoadType } from "@/app/lib/types/roads";
import {
  IGameState,
  RoadRecord,
} from "./types/general";

export class RoadsHelper {

  public static getOwnedRoads(
    ownedLocations: IGameState["ownedLocations"],
    roads: RoadRecord,
  ): Record<RoadKey, RoadType> {
    const ownedRoads: Record<RoadKey, RoadType> = {};
    for (const [fromLocation] of Object.entries(ownedLocations)) {
      const fromRoads = roads[fromLocation];
      if (!fromRoads || fromRoads.length === 0) continue;
      for (const { to: toLocation, type } of fromRoads) {
        const key = asRoadKey(
          fromLocation < toLocation
            ? `${fromLocation}-${toLocation}`
            : `${toLocation}-${fromLocation}`,
        );
        ownedRoads[key] = type;
      }
    }
    return ownedRoads;
  }

  public static areAllOwnedRoadsOfType(
    ownedLocations: IGameState["ownedLocations"],
    roads: RoadRecord,
    type: RoadType,
  ): boolean {
    const ownedRoads = this.getOwnedRoads(ownedLocations, roads);
    const types = Object.values(ownedRoads);
    if (types.length === 0) return false;
    return types.every((t) => t === type);
  }

  public static applyRoadTypeChange(
    roads: RoadRecord,
    key: RoadKey,
    type: RoadType | null,
  ): void {
    const [locationA, locationB] = key.split("-");
    if (!locationA || !locationB) {
      throw new Error(`Invalid road key: ${key}`);
    }
    if (!type) {
      const filteredA = (roads[locationA] ?? []).filter(
        (road) => road.to !== locationB,
      );
      const filteredB = (roads[locationB] ?? []).filter(
        (road) => road.to !== locationA,
      );

      if (filteredA.length > 0) {
        roads[locationA] = filteredA;
      } else {
        delete roads[locationA];
      }

      if (filteredB.length > 0) {
        roads[locationB] = filteredB;
      } else {
        delete roads[locationB];
      }
      return;
    } else {
      roads[locationA] = [
        ...(roads[locationA] ?? []).filter((road) => road.to !== locationB),
        { to: locationB, type, createdByUser: true },
      ];
      roads[locationB] = [
        ...(roads[locationB] ?? []).filter((road) => road.to !== locationA),
        { to: locationA, type, createdByUser: true },
      ];
    }
  }
}
