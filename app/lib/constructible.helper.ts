import {
  evaluateLogicTree,
  LogicTree,
  LogicTreeBuilder,
} from "./classes/logicTree";
import { LocationsHelper } from "./locations.helper";
import {
  ConstructibleAction,
  IBuildingInstance,
  INewBuildingTemplate,
  IPlacementRestrictionConfig,
  NewConstructibleState,
  PlacementRestrictions,
} from "./types/building";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
  LocationRank,
  RoadRecord,
  RoadType,
} from "./types/general";

export class ConstructibleHelper {
  public static getEligibleBuildingTemplates(
    location: ILocationIdentifier,
    gameData: IGameData,
    gameState: IGameState,
  ): INewBuildingTemplate[] {
    const locationGameData = gameData.locationDataMap[location];
    return Object.values(gameData.buildingsTemplate).filter((template) => {
      const tree = this.getBuildingSupportabilityLogicTree(
        template,
        locationGameData,
        gameState,
      );
      return evaluateLogicTree(tree);
    });
  }

  public static getNewConstructibleState(
    location: ILocationIdentifier,
    gameData: IGameData,
    gameState: IGameState,
  ): NewConstructibleState {
    const res: NewConstructibleState = {};
    const locationBuildings = gameState.ownedLocations[location].buildings;

    const eligibleBuildingTemplates = this.getEligibleBuildingTemplates(
      location,
      gameData,
      gameState,
    );

    for (const buildingTemplate of eligibleBuildingTemplates) {
      const possibleActions: ConstructibleAction[] = [];

      if (locationBuildings[buildingTemplate.name]) {
        if (
          buildingTemplate.upgrade &&
          !(buildingTemplate.upgrade in locationBuildings)
        ) {
          possibleActions.push({
            type: "upgrade",
            building: buildingTemplate.name,
            to: gameData.buildingsTemplate[buildingTemplate.upgrade],
          });
        }

        if (
          buildingTemplate.downgrade &&
          !(buildingTemplate.downgrade in locationBuildings)
        ) {
          possibleActions.push({
            type: "downgrade",
            building: buildingTemplate.name,
            to: gameData.buildingsTemplate[buildingTemplate.downgrade],
          });
        }

        if (
          buildingTemplate.buildable &&
          (!buildingTemplate.cap ||
            locationBuildings[buildingTemplate.name].level <
              buildingTemplate.cap)
        ) {
          possibleActions.push({
            type: "build",
            building: buildingTemplate.name,
          });
        }

        if (
          buildingTemplate.buildable &&
          locationBuildings[buildingTemplate.name]
        ) {
          possibleActions.push({
            type: "demolish",
            building: buildingTemplate.name,
          });
        }

        if (possibleActions.length > 0) {
          res[buildingTemplate.name] = {
            instance: locationBuildings[buildingTemplate.name] ?? null,
            possibleActions,
          };
        }
      }
    }

    for (const building of Object.values(locationBuildings)) {
      if (!res[building.template.name]) {
        res[building.template.name] = {
          instance: building,
          possibleActions: [],
        };
      }
    }

    return res;
  }

  private static evaluatePlacementCondition(
    condition: PlacementRestrictions,
    location: ILocationGameData,
    gameState: IGameState,
  ): boolean {
    switch (condition) {
      case "is_coastal":
        return location.isCoastal;
      case "has_river":
        return location.isOnRiver;
      case "is_adjacent_to_lake":
        return location.isOnLake;
      case "is_capital":
        return gameState.capitalLocation === location.name;
      case "has_road":
        return LocationsHelper.locationHasRoad(location.name, gameState.roads);
    }
  }

  private static getBuildingSupportabilityLogicTree(
    buildingTemplate: INewBuildingTemplate,
    location: ILocationGameData,
    gameState: IGameState,
  ): LogicTree {
    const placementRestrictionTree = LogicTreeBuilder.treeFromConditions(
      buildingTemplate.placementRestriction ?? {
        op: "AND",
        conditions: [],
      },
      location,
      gameState,
      this.evaluatePlacementCondition,
    );
    const root: LogicTree =
      buildingTemplate.type === "common"
        ? { type: "operator", op: "AND", children: [placementRestrictionTree] }
        : {
            type: "operator",
            op: "AND",
            children: [
              placementRestrictionTree,
              {
                type: "leaf",
                getValue: () =>
                  this.locationLevelSupportsBuilding(
                    buildingTemplate,
                    location.rank,
                  ),
              },
            ],
          };

    return root;
  }

  private static locationLevelSupportsBuilding(
    building: INewBuildingTemplate,
    rank: LocationRank,
  ) {
    switch (building.type) {
      case "common":
        return true;
      case "city":
        return rank === "city";
      case "urban":
        return rank === "city" || rank === "town";
      case "rural":
        return rank === "rural";
      default:
        return false;
    }
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
