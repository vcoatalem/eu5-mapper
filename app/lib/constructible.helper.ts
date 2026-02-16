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

  private static partitionTemplatesByFamily(
    templates: Record<INewBuildingTemplate["name"], INewBuildingTemplate>,
  ): Record<string, INewBuildingTemplate["name"][]> {
    const res: Record<string, INewBuildingTemplate["name"][]> = {};

    const { baseTemplates } = Object.values(templates).reduce((acc: { baseTemplates: INewBuildingTemplate[], upgradeTemplates: INewBuildingTemplate[] }, template) => {
      if (template.downgrade === null) {
        acc.baseTemplates.push(template);
      } else {
        acc.upgradeTemplates.push(template);
      }
      return acc;
    }, { baseTemplates: [], upgradeTemplates: [] } as { baseTemplates: INewBuildingTemplate[], upgradeTemplates: INewBuildingTemplate[] });

    for (const baseTemplate of baseTemplates) {
      res[baseTemplate.name] = [baseTemplate.name];
      let upgradeTemplate = baseTemplate.upgrade;
      while (upgradeTemplate) {
        res[baseTemplate.name].push(upgradeTemplate);
        upgradeTemplate = templates[upgradeTemplate]?.upgrade;
      }
    }

    return res;
  }

  /**
   * For each family, returns the single template name to consider: the one
   * already at the location if any, otherwise the base template of the family.
   */
  private static getRepresentativeTemplateNamesPerFamily(
    templatesByFamily: Record<string, INewBuildingTemplate["name"][]>,
    locationBuildings: Record<INewBuildingTemplate["name"], IBuildingInstance>,
  ): Set<INewBuildingTemplate["name"]> {
    const names = new Set<INewBuildingTemplate["name"]>();
    for (const [baseName, memberNames] of Object.entries(templatesByFamily)) {
      const existingInFamily = memberNames.find((name) => name in locationBuildings);
      names.add(existingInFamily ?? baseName);
    }
    return names;
  }

  public static getEligibleBuildingTemplates(
    location: ILocationIdentifier,
    gameData: IGameData,
    gameState: IGameState,
    templatesToConsider?: INewBuildingTemplate[],
  ): INewBuildingTemplate[] {
    const locationGameData = gameData.locationDataMap[location];
    const templates =
      templatesToConsider ?? Object.values(gameData.buildingsTemplate);
    return templates.filter((template) => {
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
    const locationBuildings =  gameState.ownedLocations[location].buildings;

    const templatesByFamily = this.partitionTemplatesByFamily(gameData.buildingsTemplate);
    const representativeTemplateNames = this.getRepresentativeTemplateNamesPerFamily(
      templatesByFamily,
      locationBuildings,
    );
    const templatesToConsider = Object.values(gameData.buildingsTemplate).filter(
      (t) => representativeTemplateNames.has(t.name),
    );

    const eligibleBuildingTemplates = this.getEligibleBuildingTemplates(
      location,
      gameData,
      gameState,
      templatesToConsider,
    );
    /*     console.log(`[ConstructibleHelper] eligible building templates for location ${location}`, eligibleBuildingTemplates); */

    for (const buildingTemplate of eligibleBuildingTemplates) {
      const possibleActions: ConstructibleAction[] = [];

      const alreadyExistingBuilding = locationBuildings[buildingTemplate.name];
      if (!!alreadyExistingBuilding) {
        if (
          buildingTemplate.upgrade &&
          !(buildingTemplate.upgrade in locationBuildings)
        ) {
          possibleActions.push({ // TODO : need to check recursively for upgrades and downgrades ...
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
          buildingTemplate.buildable
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

      const buildingIsNotSpecial = buildingTemplate.buildable;
      const buildingIsBaseBuilding = buildingTemplate.downgrade === null;
      const buildingCapIsNotReached =  !alreadyExistingBuilding || (!buildingTemplate.cap || locationBuildings[buildingTemplate.name].level < buildingTemplate.cap);
      if (
       buildingIsNotSpecial && buildingIsBaseBuilding && buildingCapIsNotReached
      ) {
        possibleActions.push({
          type: "build",
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

    for (const building of Object.values(locationBuildings)) {
      if (!res[building.template.name]) {
        res[building.template.name] = {
          instance: building,
          possibleActions: [],
        };
      }
    }

    /* console.log(`[ConstructibleHelper] new constructible state for location ${location}`, res); */
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
    const placementRestrictionTree = buildingTemplate.placementRestriction?.conditions?.length ? LogicTreeBuilder.treeFromConditions(
      buildingTemplate.placementRestriction,
      location,
      gameState,
      this.evaluatePlacementCondition,
    ) : {
      type: "leaf" as const,
      getValue: () => true,
    };

    const locationRankSupportsBuildingTree = {
      type: "leaf" as const,
      getValue: () =>
        this.locationLevelSupportsBuilding(
          buildingTemplate,
          gameState.ownedLocations[location.name].rank,
        ),
    } as LogicTree;


    const root: LogicTree =
    {
      type: "operator",
      op: "AND",
      children: [placementRestrictionTree, locationRankSupportsBuildingTree],
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
