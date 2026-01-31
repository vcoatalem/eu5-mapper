import { CompactGraph } from "./graph";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
} from "./types/general";
import {
  CostFunction,
  EdgeInfo,
  PathFindingOptions,
  PathfindingResult,
} from "./types/pathfinding";

export class ProximityComputationHelper {
  public static getEnvironmentalProximityCostIncreasePercentage = (
    location: ILocationGameData,
    gameData: IGameData,
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

    const vegetationCostIncreasePercentage = location.vegetation
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

    const development = location.development; // todo: use temporary value instead, to allow user modifying dev values
    const developmentCostReduction =
      development * gameData.proximityComputationRule.developmentImpact;

    const total =
      // positive proximity (cost reduction)
      totalBuildingsCostReduction +
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
    through: {
      isRiver?: boolean;
      isLand?: boolean;
      isSea?: boolean;
      isPort?: boolean;
      isLake?: boolean;
    },
    gameState: IGameState,
    rule: IProximityComputationRule,
    maritimePresence: number,
    options?: {
      logResultsForLocations?: ILocationIdentifier[];
      logMethod?: (...args: any[]) => void;
    },
  ): number {
    let baseCost = rule.baseCost;

    const isNaval = through.isSea || through.isLake;

    const flatProximityCostReduction = [
      through.isRiver ? rule.riverCostReduction : 0,
      isNaval && gameState.country.landVsNaval > 0
        ? rule.valuesImpact.landVsNaval[1].flatModifier *
          gameState.country.landVsNaval
        : 0,
      // TODO: advances ?
    ].reduce((a, b) => a + b, 0);

    if (!isNaval) {
      return baseCost - flatProximityCostReduction;
    } else {
      // Normalize maritimePresence to [0,1]
      let normalizedMaritimePresence = through.isLake
        ? 1
        : maritimePresence / 100;
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
  ): number {
    switch (transportationMode) {
      case "land":
        if (from in gameState.ownedLocations) {
          // TODO : handle unowned locations too
          return ProximityComputationHelper.getLandLocationProximityModifiers(
            gameData.locationDataMap[from],
            gameState.ownedLocations[from],
            gameData,
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

  private static getPercentageProximityCostModifiers(
    from: ILocationIdentifier,
    to: ILocationIdentifier,
    through: {
      isLand?: boolean;
      isPort?: boolean;
      isRiver?: boolean;
      isLake?: boolean;
    },
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
        isNaval ? "naval" : through.isPort ? "harbor" : "land",
        gameData,
        gameState,
      ),
    );

    // add roads

    // add ruler modifiers

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

  private static getProximityCostFunction(
    gameState: IGameState,
    gameData: IGameData,
    options?: PathFindingOptions,
  ): CostFunction {
    return (
      from: ILocationIdentifier,
      to: ILocationIdentifier,
      isRiver: boolean,
      isLand: boolean,
      isSea: boolean,
      isPort: boolean,
      isLake: boolean,
    ) => {
      const rule = gameData.proximityComputationRule;

      // For now, assume maritime presence is 30 everywhere (as percent)
      const maritimePresence = 30; // [0,100]
      const baseCost = this.getFlatProximityCost(
        { isRiver, isLand, isSea, isPort, isLake },
        gameState,
        rule,
        maritimePresence,
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
            through: { isRiver, isLand, isSea, isPort, isLake },
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
      const edgeType = isRiver
        ? "river"
        : isLand
          ? "land"
          : isSea
            ? "sea"
            : isPort
              ? "port"
              : isLake
                ? "lake"
                : "unknown";

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
        { isRiver, isLand, isPort },
        gameData,
        gameState,
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
            through: { isRiver, isLand, isSea, isPort, isLake },
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
}
