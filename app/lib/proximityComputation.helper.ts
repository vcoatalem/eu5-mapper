import { CompactGraph } from "./graph";
import {
  IConstructibleLocation,
  ICountryValues,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
  RoadType,
} from "./types/general";
import {
  CostFunction,
  EdgeInfo,
  EdgeType,
  PathFindingOptions,
  PathfindingResult,
} from "./types/pathfinding";
import { IProximityComputationRule } from "./types/proximityComputationRules";

export class ProximityComputationHelper {
  public static getEnvironmentalProximityCostIncreasePercentage = (
    location: ILocationGameData,
    gameData: IGameData,
    roadToDestination?: RoadType,
  ): number => {
    const rule = gameData.proximityComputationRule;

    if (
      !Object.keys(rule.proximityCostIncreasePercentage.topography).includes(
        location.topography,
      )
    ) {
      console.warn(
        "[ProximityComputationController] Missing topography proximity cost increase percentage for ",
        location.topography,
      );
    }
    const topographyCostIncreasePercentage =
      rule.proximityCostIncreasePercentage.topography?.[
        location.topography as keyof IProximityComputationRule["proximityCostIncreasePercentage"]["topography"]
      ] ?? 0;

    if (
      location.vegetation &&
      !Object.keys(rule.proximityCostIncreasePercentage.vegetation).includes(
        location?.vegetation,
      )
    ) {
      console.warn(
        "[ProximityComputationController] Missing vegetation proximity cost increase percentage for ",
        location.vegetation,
      );
    }

    const vegetationCostIncreasePercentage =
      location.vegetation && !roadToDestination
        ? (rule.proximityCostIncreasePercentage.vegetation?.[
            location.vegetation as keyof IProximityComputationRule["proximityCostIncreasePercentage"]["vegetation"]
          ] ?? 0)
        : 0;

    const totalEnvironmentalCostIncrease =
      topographyCostIncreasePercentage + vegetationCostIncreasePercentage;

    return totalEnvironmentalCostIncrease;
  };

  public static getLandLocationProximityModifiers = (
    location: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
    gameData: IGameData,
    country: ICountryValues,
  ): number => {
    if (location.isSea || location.isLake || !location.ownable) {
      return 0;
    }
    const buildings = locationConstructibleData?.buildings ?? []; // for unowned location, consider an empty array
    const totalBuildingsCostReduction = buildings
      .map(
        (b) => b.template.proximityCostReductionPercentage?.[b.level - 1] ?? 0,
      )
      .reduce((a, b) => a + b, 0);

    const environmentalProximityCostIncreasePercentage =
      ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage(
        location,
        gameData,
      );

    const development = location.development;
    const developmentCostReduction =
      development * gameData.proximityComputationRule.developmentImpact;

    const countryLandProximityModifiers = [
      country.landVsNaval < 0
        ? (Math.abs(country.landVsNaval) *
            gameData.proximityComputationRule.valuesImpact.landVsNaval[0]
              .percentageModifier) /
          100
        : 0,
    ];
    const countryLandProximityReduction = countryLandProximityModifiers.reduce(
      (a, b) => a + b,
      0,
    );

    const total =
      // positive proximity (cost reduction)
      totalBuildingsCostReduction +
      countryLandProximityReduction +
      developmentCostReduction -
      // negative proximity (cost increase)
      environmentalProximityCostIncreasePercentage;
    return total;
  };

  public static getLocationHarborCapacity = (
    locationData: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
  ): number => {
    const naturalHarborSuitability = locationData.naturalHarborSuitability ?? 0;

    if (!locationConstructibleData) {
      // unowned location
      return naturalHarborSuitability;
    }

    const buildings = locationConstructibleData.buildings ?? [];
    const totalBuildingsHarborCapacity = buildings
      .map((b) => {
        const capacity = b.template.harborCapacity?.[b.level - 1];
        return capacity || 0;
      })
      .reduce((a, b) => a + b, 0);

    return naturalHarborSuitability + totalBuildingsHarborCapacity;
  };

  public static getLocalProximitySourceLocations(
    gameState: IGameState,
  ): Record<ILocationIdentifier, number> {
    const proximitySourceLocations: Record<ILocationIdentifier, number> = {};
    for (const locationName of Object.keys(gameState.ownedLocations)) {
      if (gameState.capitalLocation === locationName) {
        proximitySourceLocations[locationName] = 100;
      } else {
        const locationBuildings =
          gameState.ownedLocations[locationName].buildings;
        const highestProximitySource = Math.max(
          ...locationBuildings.map(
            (b) => b.template.localProximitySource?.[b.level - 1] || 0,
          ),
        );
        if (highestProximitySource > 0) {
          proximitySourceLocations[locationName] = highestProximitySource;
        }
      }
    }
    return proximitySourceLocations;
  }

  private static getFlatProximityCost(
    edgeType: EdgeType,
    gameState: IGameState,
    rule: IProximityComputationRule,
    maritimePresence: number,
    roadToDestination: RoadType | null,
    options?: {
      logResultsForLocations?: ILocationIdentifier[];
      logMethod?: (...args: any[]) => void;
    },
  ): number {
    const baseCost = edgeType.includes("river")
      ? rule.baseRiverCost
      : rule.baseCost;

    const isImpactedByRoad = edgeType === "land";
    const isNaval = edgeType === "sea" || edgeType === "lake";

    const flatProximityCostReduction = [
      isNaval && gameState.country.landVsNaval > 0
        ? (rule.valuesImpact.landVsNaval[1].flatModifier *
            gameState.country.landVsNaval) /
          100
        : 0,
      isImpactedByRoad && roadToDestination
        ? rule.roadProximityCostReduction[roadToDestination]
        : 0,
      // TODO: advances ?
    ].reduce((a, b) => a + b, 0);

    if (!isNaval) {
      return baseCost - flatProximityCostReduction;
    } else {
      // Normalize maritimePresence to [0,1]
      let normalizedMaritimePresence =
        edgeType === "lake" ? 1 : maritimePresence / 100;
      normalizedMaritimePresence = Math.max(
        0,
        Math.min(1, normalizedMaritimePresence),
      );

      const flatProximityCostWithoutMaritimePresence = [
        // ... advances
      ].reduce((a, b) => a + b, 0);

      const flatProximityCostWithMaritimePresence = [
        // ... advances
      ].reduce((a, b) => a + b, 0);

      const costWithoutMaritimePresence =
        rule.baseCostWithoutMaritimePresence -
        flatProximityCostWithoutMaritimePresence;
      const costWithMaritimePresence =
        rule.baseCostWithMaritimePresence -
        flatProximityCostWithMaritimePresence;

      return (
        costWithoutMaritimePresence * (1 - normalizedMaritimePresence) +
        costWithMaritimePresence * normalizedMaritimePresence
      );
    }
  }

  private static getTransportationModeProximityCostModifiers(
    from: ILocationIdentifier,
    to: ILocationIdentifier,
    transportationMode: "land" | "naval" | "harbor",
    gameData: IGameData,
    gameState: IGameState,
    options?: PathFindingOptions,
  ): number {
    switch (transportationMode) {
      case "land":
        if (
          from in gameState.ownedLocations ||
          options?.allowUnownedLocations
        ) {
          return ProximityComputationHelper.getLandLocationProximityModifiers(
            gameData.locationDataMap[from],
            gameState.ownedLocations[from],
            gameData,
            gameState.country,
          );
        } else {
          return 0;
        }
      case "harbor":
        const locationWithHarbor = gameData.locationDataMap[to].isSea
          ? from
          : to;
        const harborCapacity =
          ProximityComputationHelper.getLocationHarborCapacity(
            gameData.locationDataMap[locationWithHarbor],
            gameState.ownedLocations[locationWithHarbor],
          );
        const harborImpact =
          gameData.proximityComputationRule.harborCapacityImpact;
        const proximityModifier = 1 - (harborImpact * harborCapacity) / 100;
        return proximityModifier;
      case "naval":
      default:
        return 0;
    }
  }

  private static getGenericCountryProximityCostModifiers(
    country: ICountryValues,
    rule: IProximityComputationRule,
  ): number {
    return [
      country.centralizationVsDecentralization < 0
        ? (Math.abs(country.centralizationVsDecentralization) *
            rule.valuesImpact.centralizationVsDecentralization[0]
              .percentageModifier) /
          100
        : 0,
      country.rulerAdministrativeAbility *
        rule.rulerAdministrativeAbilityImpact,
    ].reduce((a, b) => a + b, 0);
  }

  private static getPercentageProximityCostModifiers(
    from: ILocationIdentifier,
    to: ILocationIdentifier,
    edgeType: EdgeType,
    gameData: IGameData,
    gameState: IGameState,
    options?: PathFindingOptions,
  ): number {
    const modifiers: number[] = [];

    const toLocationData = gameData.locationDataMap[to];
    const isNaval = toLocationData.isSea || toLocationData.isLake;

    modifiers.push(
      this.getTransportationModeProximityCostModifiers(
        from,
        to,
        isNaval ? "naval" : edgeType === "port" ? "harbor" : "land",
        gameData,
        gameState,
        options,
      ),
      this.getGenericCountryProximityCostModifiers(
        gameState.country,
        gameData.proximityComputationRule,
      ),
    );

    if (
      options?.logForLocations?.includes(from) ||
      options?.logForLocations?.includes(to)
    ) {
      options.logMethod?.(
        "[ProximityComputationHelper] Proximity cost modifiers for",
        { from, to, isNaval, modifiers },
      );
    }

    return modifiers.reduce((a, b) => a + b, 0);
  }

  public static getProximityCostFunction(
    gameState: IGameState,
    gameData: IGameData,
    options?: PathFindingOptions,
  ): CostFunction {
    return (
      from: ILocationIdentifier,
      to: ILocationIdentifier,
      edgeType: EdgeType,
    ) => {
      const rule = gameData.proximityComputationRule;

      const [locationA, locationB] = [from, to].sort(); // same sorting as in graph.
      const road = gameData.roads[locationA]?.find(
        ({ to }) => to === locationB,
      );
      // For now, assume maritime presence is 30 everywhere (as percent)
      const maritimePresence = 30; // [0,100]
      const baseCost = this.getFlatProximityCost(
        edgeType,
        gameState,
        rule,
        maritimePresence,
        road?.type ?? null,
      );

      if (
        options?.logForLocations?.includes(from) ||
        options?.logForLocations?.includes(to)
      ) {
        options.logMethod?.(
          "[ProximityComputationHelper] base proximity cost for",
          {
            from,
            to,
            through: { edgeType },
            baseCost,
          },
        );
      }

      /*  console.log("enter proximity cost function", {
        from,
        to,
        through: { isRiver, isLand, isSea, isPort, isLake },
        context: this.gameData,
        gameState,
      }); */

      const toLocationData = gameData.locationDataMap[to];
      const isToSeaZone = toLocationData.isSea;
      const isToLakeZone = toLocationData.isLake;

      // Only allow routing through unowned sea and lake zones
      // Block all other unowned locations (land, ports, etc.)
      // TODO: make this an option (e.g., for vassals, allies, etc.)
      if (
        !options?.allowUnownedLocations &&
        !Object.keys(gameState.ownedLocations).includes(to) &&
        !isToSeaZone &&
        !isToLakeZone
      ) {
        // TODO: handle going over vassal land (handle vassals in future)
        return { cost: 100, through: edgeType };
      }

      const proximityModifiersSummed = this.getPercentageProximityCostModifiers(
        from,
        to,
        edgeType,
        gameData,
        gameState,
        options,
      );

      const modifiedCost = baseCost * (1 - proximityModifiersSummed / 100);

      if (
        options?.logForLocations?.includes(from) ||
        options?.logForLocations?.includes(to)
      ) {
        options?.logMethod?.(
          "[ProximityComputationHelper] Final proximity cost for",
          {
            from,
            to,
            edgeType,
            modifiedCost,
          },
        );
      }

      return {
        cost: modifiedCost,
        through: edgeType,
      };
    };
  }

  public static getGameStateProximityComputation = (
    gameState: IGameState,
    gameData: IGameData,
    adjacencyGraph: CompactGraph,
    options?: PathFindingOptions,
  ): PathfindingResult => {
    const proximityResults: Record<string, PathfindingResult> = {};

    const proximitySourceLocations =
      ProximityComputationHelper.getLocalProximitySourceLocations(gameState);

    for (const [locationName, proximitySource] of Object.entries(
      proximitySourceLocations,
    )) {
      proximityResults[locationName] = adjacencyGraph.reachableWithinCost(
        locationName,
        proximitySource,
        ProximityComputationHelper.getProximityCostFunction(
          gameState,
          gameData,
          options,
        ),
      );
    }

    const mergedResults: PathfindingResult = {};
    for (const [location, resultMap] of Object.entries(proximityResults)) {
      for (const [target, result] of Object.entries(resultMap)) {
        const deducedCost =
          100 - proximitySourceLocations[location] + result.cost;
        if (
          !(target in mergedResults) ||
          deducedCost < mergedResults[target].cost
        ) {
          mergedResults[target] = {
            cost: deducedCost,
            through: result.through,
          };
        }
      }
    }
    return mergedResults;
  };

  public static getGameStateLocationNeighborsProximity = (
    location: ILocationIdentifier,
    gameState: IGameState,
    gameData: IGameData,
    adjacencyGraph: CompactGraph,
    options?: PathFindingOptions,
  ): PathfindingResult => {
    const neighbors = adjacencyGraph.reachableWithinEdges(
      location,
      1,
      ProximityComputationHelper.getProximityCostFunction(
        gameState,
        gameData,
        options,
      ),
    );

    return neighbors;
  };

  /**
   * converts pathfinding evaluation to "proximity" value as displayed in-game
   */
  public static evaluationToProximity(evaluationCost: number): number {
    if (isNaN(evaluationCost)) return 0;
    const proximity = Math.max(0, 100 - evaluationCost).toFixed(2);
    return Number(proximity);
  }
}
