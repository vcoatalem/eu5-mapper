import { LocationsHelper } from "./locations.helper";
import {
  IBuildingTemplate,
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
  PlacementRestrictions,
  RoadRecord,
  RoadType,
} from "./types/general";

type ConstructibleState = {
  buildings: Array<{
    name: IBuildingTemplate["name"];
    amountBuilt: number;
    canBuild: boolean;
    reason: string | null;
  }>;
};

export class ConstructibleHelper {
  private static evaluatePlacementCondition(
    condition: PlacementRestrictions,
    location: ILocationGameData,
    roads: RoadRecord,
  ): boolean {
    switch (condition) {
      case "is_coastal":
        return location.isCoastal;
      case "is_on_river":
        return location.isOnRiver;
      case "is_on_lake":
        return location.isOnLake;
      case "has_road":
        return LocationsHelper.locationHasRoad(location.name, roads);
    }
  }

  private static locationDataSupportsBuildingRestrictions(
    building: IBuildingTemplate,
    location: ILocationGameData,
    roads: RoadRecord,
  ): boolean {
    if (!building.placementRestriction) return true;

    const restrictions = building.placementRestriction;

    let res: boolean = false;
    if (restrictions.mode === "all") {
      res = restrictions.conditions.every((condition) =>
        this.evaluatePlacementCondition(condition, location, roads),
      );
    } else if (restrictions.mode === "any") {
      res = restrictions.conditions.some((condition) =>
        this.evaluatePlacementCondition(condition, location, roads),
      );
    }

    return res;
  }

  private static locationLevelSupportsBuilding(
    building: IBuildingTemplate,
    constructible: IConstructibleLocation,
  ) {
    switch (building.type) {
      case "common":
        return true;
      case "city":
        return constructible.rank === "city";
      case "urban":
        return constructible.rank === "city" || constructible.rank === "town";
      case "rural":
        return constructible.rank === "rural";
      default:
        return false;
    }
  }

  private static locationAlreadyAtMaxCapacityForBuilding(
    building: IBuildingTemplate,
    constructible: IConstructibleLocation,
  ): boolean {
    const alreadyBuilt = constructible.buildings.find(
      (b) => b.template.name === building.name,
    );
    if (!alreadyBuilt) return false;

    return alreadyBuilt && alreadyBuilt.level >= building.levels;
  }

  public static getBuildability(
    building: IBuildingTemplate,
    location: ILocationIdentifier,
    gameData: IGameData,
    ownedLocations: IGameState["ownedLocations"],
    roads: RoadRecord,
  ): { canBuild: boolean; reason: null | "limit" | "restriction" } {
    const locationSupportsBuilding =
      this.locationDataSupportsBuildingRestrictions(
        building,
        gameData.locationDataMap[location],
        roads,
      );

    if (!locationSupportsBuilding) {
      return { canBuild: false, reason: "restriction" };
    }

    if (
      !this.locationLevelSupportsBuilding(building, ownedLocations[location])
    ) {
      return { canBuild: false, reason: "restriction" };
    }

    if (
      this.locationAlreadyAtMaxCapacityForBuilding(
        building,
        ownedLocations[location],
      )
    ) {
      return { canBuild: false, reason: "limit" };
    }

    // todo : country restrictions, location restrictions

    return { canBuild: true, reason: null };
  }

  public static getConstructibleState(
    location: ILocationIdentifier,
    constructible: IConstructibleLocation,
    gameData: IGameData,
    ownedLocations: IGameState["ownedLocations"],
  ): ConstructibleState {
    const constructibleState: ConstructibleState = { buildings: [] };

    const templates = Object.values(gameData.buildingsTemplateMap).sort(
      (a, b) => a.name.localeCompare(b.name),
    );

    for (const buildingTemplate of templates) {
      const buildability = this.getBuildability(
        buildingTemplate,
        location,
        gameData,
        ownedLocations,
        gameData.roads,
      );

      constructibleState.buildings.push({
        name: buildingTemplate.name,
        amountBuilt:
          constructible.buildings.find(
            (b) => b.template.name === buildingTemplate.name,
          )?.level || 0,
        canBuild: buildability.canBuild,
        reason: buildability.reason,
      });
    }
    return constructibleState;
  }

  public static getOwnedRoads(
    ownedLocations: IGameState["ownedLocations"],
    roads: RoadRecord,
  ): Record<string, RoadType> {
    // key is `${ILocationIdentifierFrom}-${ILocationIdentifierTo}`
    const ownedRoads: Record<ILocationIdentifier, RoadType> = {};
    for (const [fromLocation] of Object.entries(ownedLocations)) {
      const fromRoads = roads[fromLocation];
      if (!fromRoads || fromRoads.length === 0) continue;
      for (const { to: toLocation, type } of fromRoads) {
        const key =
          fromLocation < toLocation
            ? `${fromLocation}-${toLocation}`
            : `${toLocation}-${fromLocation}`;
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
    key: string,
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
