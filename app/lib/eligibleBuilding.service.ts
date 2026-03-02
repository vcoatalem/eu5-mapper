import {
  evaluateLogicTree,
  LogicTree,
  LogicTreeBuilder,
} from "@/app/lib/classes/logicTree";
import { LocationsHelper } from "@/app/lib/locations.helper";
import {
  ConstructibleAction,
  IBuildingInstance,
  INewBuildingTemplate,
  NewConstructibleState,
  PlacementRestrictions,
} from "@/app/lib/types/building";
import {
  BaseRoadRecord,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
  LocationRank,
} from "@/app/lib/types/general";

type IBuildingTemplateIdentifier = INewBuildingTemplate["name"];

export class EligibleBuildingService {
  private readonly buildingTemplateMapping: Record<
    IBuildingTemplateIdentifier,
    { tree: LogicTree; data: INewBuildingTemplate }
  >;
  private readonly templateFamilyMapping: Record<
    IBuildingTemplateIdentifier,
    Array<IBuildingTemplateIdentifier>
  >;
  private readonly locationDataMap: IGameData["locationDataMap"];
  private readonly baseRoads: BaseRoadRecord;

  constructor(gameData: IGameData) {
    this.locationDataMap = gameData.locationDataMap;
    this.baseRoads = gameData.roads;
    console.log(
      "[EligibleBuildingService] initializing with building templates:",
      Object.values(gameData.buildingsTemplate),
    );
    this.buildingTemplateMapping = {};
    const getLocationData = (id: ILocationIdentifier) =>
      this.locationDataMap[id];
    for (const [templateName, templateData] of Object.entries(
      gameData.buildingsTemplate,
    )) {
      this.buildingTemplateMapping[templateName] = {
        tree: this.getBuildingSupportabilityLogicTree(
          templateData,
          getLocationData,
        ),
        data: templateData,
      };
    }
    this.templateFamilyMapping =
      EligibleBuildingService.partitionTemplatesByFamily(
        gameData.buildingsTemplate,
      );
  }

  private getBuildingSupportabilityLogicTree(
    buildingTemplate: INewBuildingTemplate,
    getLocationData: (
      locationId: ILocationIdentifier,
    ) => ILocationGameData | undefined,
  ): LogicTree {
    const placementRestrictionTree = buildingTemplate.placementRestriction
      ?.conditions?.length
      ? LogicTreeBuilder.treeFromConditions(
          buildingTemplate.placementRestriction,
          getLocationData,
          this.evaluatePlacementCondition.bind(this),
        )
      : {
          type: "leaf" as const,
          getValue: () => true,
        };

    const locationRankSupportsBuildingTree = {
      type: "leaf" as const,
      getValue: (gameState: IGameState, location: ILocationIdentifier) =>
        EligibleBuildingService.locationLevelSupportsBuilding(
          buildingTemplate,
          gameState.ownedLocations[location]?.rank ?? "rural",
        ),
    } as LogicTree;

    const root: LogicTree = {
      type: "operator",
      op: "AND",
      children: [placementRestrictionTree, locationRankSupportsBuildingTree],
    };

    return root;
  }

  private evaluatePlacementCondition(
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
        return LocationsHelper.locationHasRoad(
          location.name,
          this.baseRoads,
          gameState.roads,
        );
      case "is_not_capital":
        return gameState.capitalLocation !== location.name;
    }
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

  private static partitionTemplatesByFamily(
    templates: Record<IBuildingTemplateIdentifier, INewBuildingTemplate>,
  ): Record<IBuildingTemplateIdentifier, IBuildingTemplateIdentifier[]> {
    const res: Record<
      IBuildingTemplateIdentifier,
      IBuildingTemplateIdentifier[]
    > = {};

    const { baseTemplates } = Object.values(templates).reduce(
      (
        acc: {
          baseTemplates: INewBuildingTemplate[];
          upgradeTemplates: INewBuildingTemplate[];
        },
        template,
      ) => {
        if (template.downgrade === null) {
          acc.baseTemplates.push(template);
        } else {
          acc.upgradeTemplates.push(template);
        }
        return acc;
      },
      { baseTemplates: [], upgradeTemplates: [] } as {
        baseTemplates: INewBuildingTemplate[];
        upgradeTemplates: INewBuildingTemplate[];
      },
    );

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
    templatesByFamily: Record<
      IBuildingTemplateIdentifier,
      IBuildingTemplateIdentifier[]
    >,
    locationBuildings: Record<IBuildingTemplateIdentifier, IBuildingInstance>,
  ): Set<IBuildingTemplateIdentifier> {
    const names = new Set<IBuildingTemplateIdentifier>();
    for (const [baseName, memberNames] of Object.entries(templatesByFamily)) {
      const existingInFamily = memberNames.find(
        (name) => name in locationBuildings,
      );
      names.add(existingInFamily ?? baseName);
    }
    return names;
  }

  public getEligibleBuildingTemplates(
    location: ILocationIdentifier,
    gameState: IGameState,
  ): INewBuildingTemplate[] {
    return Object.values(this.buildingTemplateMapping)
      .filter(({ tree }) => {
        return evaluateLogicTree(tree, location, gameState);
      })
      .map(({ data }) => data);
  }

  public getConstructibleState(
    location: ILocationIdentifier,
    gameState: IGameState,
  ): NewConstructibleState {
    const res: NewConstructibleState = {};
    const locationBuildings = gameState.ownedLocations[location].buildings;
    const representativeTemplateNames =
      EligibleBuildingService.getRepresentativeTemplateNamesPerFamily(
        this.templateFamilyMapping,
        locationBuildings,
      );
    const eligibleBuildingTemplates = this.getEligibleBuildingTemplates(
      location,
      gameState,
    );
    const templatesToConsider = Object.values(eligibleBuildingTemplates).filter(
      (template) => representativeTemplateNames.has(template.name),
    );

    for (const buildingTemplate of Object.values(templatesToConsider)) {
      const possibleActions: ConstructibleAction[] = [];

      const alreadyExistingBuilding = locationBuildings[buildingTemplate.name];
      if (!!alreadyExistingBuilding) {
        if (
          buildingTemplate.upgrade &&
          !(buildingTemplate.upgrade in locationBuildings)
        ) {
          possibleActions.push({
            // TODO : need to check recursively for upgrades and downgrades ...
            type: "upgrade",
            building: buildingTemplate.name,
            to: this.buildingTemplateMapping[buildingTemplate.upgrade].data,
          });
        }

        if (
          buildingTemplate.downgrade &&
          !(buildingTemplate.downgrade in locationBuildings)
        ) {
          possibleActions.push({
            type: "downgrade",
            building: buildingTemplate.name,
            to: this.buildingTemplateMapping[buildingTemplate.downgrade].data,
          });
        }

        if (buildingTemplate.buildable) {
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
      const buildingCapIsNotReached =
        !alreadyExistingBuilding ||
        !buildingTemplate.cap ||
        locationBuildings[buildingTemplate.name].level < buildingTemplate.cap;
      if (
        buildingIsNotSpecial &&
        buildingIsBaseBuilding &&
        buildingCapIsNotReached
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
}
