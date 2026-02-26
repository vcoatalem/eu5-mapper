import { asRoadKey, RoadKey, RoadType } from "@/app/lib/types/roads";
import {
  BaseRoadRecord,
  IGameState,
  ILocationIdentifier,
  RoadRecord,
} from "./types/general";
import { ObjectHelper } from "@/app/lib/object.helper";

export class RoadsHelper {
  public static buildOrderedRoadKey(
    fromLocation: ILocationIdentifier,
    toLocation: ILocationIdentifier,
  ): RoadKey {
    return asRoadKey(
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
    for (const [key, type] of ObjectHelper.getTypedEntries(stateRoads)) {
      if (type != null) result[key] = type;
    }
    for (const [key, type] of ObjectHelper.getTypedEntries(baseRoads)) {
      if (!(key in result)) result[key] = type;
    }
    return result;
  }

  public static getOwnedRoads(
    ownedLocations: IGameState["ownedLocations"],
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
    ownedLocations: IGameState["ownedLocations"],
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
    fromLocation: ILocationIdentifier,
    toLocation: ILocationIdentifier,
    baseRoads: BaseRoadRecord,
    stateRoads: RoadRecord,
  ): RoadType | null {
    const key = this.buildOrderedRoadKey(fromLocation, toLocation);
    const stateType = stateRoads[key];
    if (stateType !== undefined) return stateType;
    return baseRoads[key] ?? null;
  }
}
