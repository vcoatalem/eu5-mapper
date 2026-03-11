import {
  BaseRoadRecord,
  RoadKey,
  RoadRecord,
  RoadType,
  ZodRoadKey,
} from "@/app/lib/types/roads";
import { LocationIdentifier } from "./types/general";
import { ObjectHelper } from "@/app/lib/object.helper";
import {
  GameState,
  GameStateOwnedLocationRecord,
} from "@/app/lib/types/gameState";

export class RoadsHelper {
  public static roadRecordFromCsv(csvRows: [string, string][]): BaseRoadRecord {
    const record: BaseRoadRecord = {};
    for (const [from, to] of csvRows) {
      const key = this.buildOrderedRoadKey(from, to);
      record[key] = "gravel_road";
    }
    return record;
  }

  public static buildOrderedRoadKey(
    fromLocation: LocationIdentifier,
    toLocation: LocationIdentifier,
  ): RoadKey {
    return ZodRoadKey.parse(
      fromLocation.localeCompare(toLocation) < 0
        ? `${fromLocation}-${toLocation}`
        : `${toLocation}-${fromLocation}`,
    );
  }

  public static getRoads(
    baseRoads: BaseRoadRecord,
    stateRoads: RoadRecord,
  ): BaseRoadRecord {
    const result: BaseRoadRecord = {};

    for (const [key, type] of ObjectHelper.getTypedEntries(baseRoads)) {
      if (!(key in result)) result[key] = type;
    }

    for (const [key, type] of ObjectHelper.getTypedEntries(stateRoads)) {
      result[key] = type;
    }

    return result;
  }

  public static getOwnedRoads(
    ownedLocations: GameState["ownedLocations"],
    baseRoads: BaseRoadRecord,
    stateRoads: RoadRecord,
  ): Record<RoadKey, RoadType> {
    const resolved = this.getRoads(baseRoads, stateRoads);
    const ownedRoads: Record<RoadKey, RoadType> = {};
    for (const [key, type] of ObjectHelper.getTypedEntries(resolved)) {
      const [from, to] = key.split("-");
      if (!(from in ownedLocations) || !(to in ownedLocations)) continue;
      ownedRoads[key] = type;
    }
    return ownedRoads;
  }

  public static areAllOwnedRoadsOfType(
    ownedLocations: GameState["ownedLocations"],
    baseRoads: BaseRoadRecord,
    stateRoads: RoadRecord,
    type: RoadType,
  ): boolean {
    const ownedRoads = this.getOwnedRoads(
      ownedLocations,
      baseRoads,
      stateRoads,
    );
    const types = Object.values(ownedRoads);
    if (types.length === 0) return false;
    return types.every((t) => t === type);
  }

  public static getRoad(
    fromLocation: LocationIdentifier,
    toLocation: LocationIdentifier,
    baseRoads: BaseRoadRecord,
    stateRoads: RoadRecord,
  ): RoadType | null {
    const key = this.buildOrderedRoadKey(fromLocation, toLocation);
    const stateType = stateRoads[key];
    if (stateType !== undefined) return stateType;
    return baseRoads[key] ?? null;
  }
}
