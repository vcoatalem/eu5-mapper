import { LocationsHelper } from "@/app/lib/locations.helper";
import { ProximityBuffsRecord } from "./classes/countryProximityBuffs";
import { CompactGraph } from "./graph";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
  ITemporaryLocationData,
  RoadType,
} from "./types/general";
import {
  CostFunction,
  EdgeType,
  PathFindingOptions,
  PathfindingResult,
} from "./types/pathfinding";
import { IProximityBuffs, IProximityComputationRule } from "./types/proximityComputationRules";

/**
 * Unified logging utility for proximity computation methods
 * Uses PathFindingOptions for consistent logging across all methods
 */
const logProximityComputation = (
  location: ILocationIdentifier | ILocationIdentifier[],
  options: PathFindingOptions,
  message?: string,
  data?: Record<string, unknown>,
) => {
  if (!options.logMethod || !options.logForLocations) return;

  const locationsToCheck = Array.isArray(location) ? location : [location];
  const shouldLog = locationsToCheck.some((loc) =>
    options.logForLocations!.includes(loc),
  );

  if (shouldLog) {
    const locationData: Record<string, unknown> = Array.isArray(location)
      ? { locations: location }
      : { location };

    const logMessage = message
      ? `[ProximityComputationHelper] ${message}`
      : "[ProximityComputationHelper]";

    const mergedData: Record<string, unknown> = data
      ? { ...locationData, ...data }
      : locationData;

    options.logMethod(logMessage, mergedData);
  }
};
export class ProximityComputationHelper {
  public static getEnvironmentalProximityCostIncreasePercentage = (
    location: ILocationGameData,
    gameData: IGameData,
    proximityBuffs: ProximityBuffsRecord,
    discardVegetationModifiers: boolean,
    options: PathFindingOptions,
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
    let topographyCostIncreasePercentage =
      rule.proximityCostIncreasePercentage.topography?.[
        location.topography as keyof IProximityComputationRule["proximityCostIncreasePercentage"]["topography"]
      ] ?? 0;
    
      const buffKey = `${location.topography}Multiplier`;
      if (["mountainsMultiplier", "plateauMultiplier", "hillsMultiplier"].includes(buffKey)) {
        const buffs = proximityBuffs.getBuffsOfType(buffKey as keyof IProximityBuffs);
        const multipliers = Object.values(buffs.buffRecord).reduce((a, b) => a * b, 1);
        topographyCostIncreasePercentage *= multipliers;
    }

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
      location.vegetation && !discardVegetationModifiers
        ? (rule.proximityCostIncreasePercentage.vegetation?.[
            location.vegetation as keyof IProximityComputationRule["proximityCostIncreasePercentage"]["vegetation"]
          ] ?? 0)
        : 0;

    logProximityComputation(
      location.name,
      options,
      "Environmental proximity cost increase percentage",
      {
        topographyCostIncreasePercentage,
        vegetationCostIncreasePercentage,
        discardVegetationModifiers,
      },
    );

    const totalEnvironmentalCostIncrease =
      topographyCostIncreasePercentage + vegetationCostIncreasePercentage;

    return totalEnvironmentalCostIncrease;
  };

  public static getLandLocationProximityModifiers = (
    location: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
    locationTemporaryData: ITemporaryLocationData | null,
    gameData: IGameData,
    behaviour: {
      discardVegetationModifiers: boolean;
      discardVegetationAndTopographyModifiers: boolean;
    },
    proximityBuffs: ProximityBuffsRecord,
    options: PathFindingOptions,
  ): number => {
    if (location.isSea || location.isLake || !location.ownable) {
      return 0;
    }
    const buildings = locationConstructibleData?.buildings ?? []; // for unowned location, consider an empty array
    const totalBuildingsCostReduction = Object.values(buildings)
      .map(
        (b) =>
          Math.abs(b.template.modifiers.localProximityCostModifier ?? 0) *
          100 * // O.0.11 effects are negative floats, 1.1.4 positive - we might need to change this formula if there are buildings giving negative local prox in the future
          b.level,
      )
      .reduce((a, b) => a + b, 0);

    const environmentalProximityCostIncreasePercentage =
      behaviour.discardVegetationAndTopographyModifiers
        ? 0
        : ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage(
            location,
            gameData,
            proximityBuffs,
            behaviour.discardVegetationModifiers, // road
            options,
          );

    const development = locationTemporaryData?.development ?? location.development;
    const developmentCostReduction =
      development * gameData.proximityComputationRule.developmentImpact;
    const landModifierFromBuffs = proximityBuffs.getBuffsOfType("landModifier");

    logProximityComputation(
      location.name,
      options,
      "Land location proximity modifiers",
      {
        totalBuildingsCostReduction,
        landModifierFromBuffs,
        developmentCostReduction,
        environmentalProximityCostIncreasePercentage,
      },
    );
    const total =
      // positive proximity (cost reduction)
      totalBuildingsCostReduction +
      landModifierFromBuffs.sum +
      developmentCostReduction -
      // negative proximity (cost increase)
      environmentalProximityCostIncreasePercentage;
    return total;
  };

  public static getLocalProximitySourceLocations(
    gameState: IGameState,
  ): Record<ILocationIdentifier, number> {
    const proximitySourceLocations: Record<ILocationIdentifier, number> = {};
    for (const locationName of Object.keys(gameState.ownedLocations)) {
      if (gameState.capitalLocation === locationName) {
        proximitySourceLocations[locationName] = 100;
      } else {
        const locationBuildings = Object.values(
          gameState.ownedLocations[locationName].buildings,
        );
        const highestProximitySource = Math.max(
          ...locationBuildings.map(
            (b) => b.template.modifiers.localProximitySource ?? 0,
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
    rule: IProximityComputationRule,
    maritimePresence: number,
    roadToDestination: RoadType | null,
    proximityBuffs: ProximityBuffsRecord,
  ): number {
    const baseCost = edgeType.includes("river")
      ? rule.baseRiverCost
      : rule.baseCost;

    const isImpactedByRoad = edgeType === "land";
    const isNaval =
      edgeType === "sea" ||
      edgeType === "lake" ||
      (!rule.throughSeaEdgeCountedAsLandProximity &&
        edgeType === "through-sea");

    if (edgeType === "port") {
      const portFlatCostReduction =
        proximityBuffs.getBuffsOfType("portFlatCostReduction").sum ?? 0;
      return baseCost - portFlatCostReduction;
    }
    if (!isNaval) {
      const roadFlatCostReduction =
        isImpactedByRoad && roadToDestination
          ? rule.roadProximityCostReduction[roadToDestination]
          : 0;
      return baseCost - roadFlatCostReduction;
    } else {
      // Normalize maritimePresence to [0,1]
      const normalizedMaritimePresence = Math.max(0, Math.min(1, maritimePresence / 100));
      const costWithoutMaritimePresence =
        rule.baseCostWithoutMaritimePresence -
        (proximityBuffs.getBuffsOfType("seaWithoutMaritimeFlatCostReduction")
          .sum ?? 0);
      const costWithMaritimePresence =
        rule.baseCostWithMaritimePresence -
        (proximityBuffs.getBuffsOfType("seaWithMaritimeFlatCostReduction")
          .sum ?? 0);
      return (
        costWithoutMaritimePresence * (1 - normalizedMaritimePresence) +
        costWithMaritimePresence * normalizedMaritimePresence
      );
    }
  }

  private static getTransportationModeProximityCostModifiers(
    from: ILocationIdentifier,
    to: ILocationIdentifier,
    transportationMode: "land" | "naval" | "harbor" | "coastal",
    gameData: IGameData,
    gameState: IGameState,
    roadType: RoadType | null,
    proximityBuffs: ProximityBuffsRecord,
    options: PathFindingOptions,
  ): number {
    switch (transportationMode) {
      case "land":
        if (from in gameState.ownedLocations || options.allowUnownedLocations) {
          return ProximityComputationHelper.getLandLocationProximityModifiers(
            gameData.locationDataMap[from],
            gameState.ownedLocations[from],
            gameState.temporaryLocationData[from] ?? null,
            gameData,
            {
              discardVegetationModifiers: !!roadType,
              discardVegetationAndTopographyModifiers: false,
            },
            proximityBuffs,
            options,
          );
        } else {
          return 0;
        }
      case "harbor":
        const toLocation = gameData.locationDataMap[to];
        const fromLocation = gameData.locationDataMap[from];
        const locationWithHarbor = toLocation.isSea ? from : to;
        const harborCapacity =
          LocationsHelper.getLocationHarborSuitability(
            gameData.locationDataMap[locationWithHarbor],
            gameState.ownedLocations[locationWithHarbor],
          );
        const harborImpact =
          gameData.proximityComputationRule.harborCapacityImpact;

        const harborCapacityModifier = harborCapacity * harborImpact * 100;

        if (fromLocation.isSea) {
          return harborCapacityModifier;
        } else {
          // when going OUT from harbor, also apply land location proximity modifiers
          const harborLocationProximityModifiers =
            ProximityComputationHelper.getLandLocationProximityModifiers(
              gameData.locationDataMap[locationWithHarbor],
              gameState.ownedLocations[locationWithHarbor],
              gameState.temporaryLocationData[locationWithHarbor] ?? null,
              gameData,
              {
                discardVegetationAndTopographyModifiers: true,
                discardVegetationModifiers: true,
              },
              proximityBuffs,
              options,
            );
          logProximityComputation(
            locationWithHarbor,
            options,
            "Summing Harbor Modifiers",
            { harborLocationProximityModifiers, harborCapacityModifier },
          );
          return harborLocationProximityModifiers + harborCapacityModifier;
        }
      case "naval":
      case "coastal":
        return 0;
    }
  }

  private static getPercentageProximityCostModifiers(
    from: ILocationIdentifier,
    to: ILocationIdentifier,
    edgeType: EdgeType,
    gameData: IGameData,
    gameState: IGameState,
    proximityBuffs: ProximityBuffsRecord,
    options: PathFindingOptions,
    roadType: RoadType | null,
  ): number {
    const rule = gameData.proximityComputationRule;

    const toLocationData = gameData.locationDataMap[to];
    const isNaval = toLocationData.isSea || toLocationData.isLake;

    // Check for port/port-river edges first, as they need harbor modifiers regardless of destination
    const transportationMode =
      edgeType === "port" || edgeType === "port-river"
        ? "harbor"
        : isNaval ||
            (!rule.throughSeaEdgeCountedAsLandProximity &&
              edgeType === "through-sea")
          ? "naval"
          : edgeType === "coastal"
            ? "coastal"
            : "land";

    const modifiers = [
      this.getTransportationModeProximityCostModifiers(
        from,
        to,
        transportationMode,
        gameData,
        gameState,
        roadType,
        proximityBuffs,
        options,
      ),
      proximityBuffs.getBuffsOfType("genericModifier").sum ?? 0,
    ];

    logProximityComputation([from, to], options, "Proximity cost modifiers", {
      from,
      to,
      isNaval,
      transporationModeModifiersSummed: modifiers[0],
      genericModifierSummed: modifiers[1],
    });

    return modifiers.reduce((a, b) => a + b, 0);
  }

  public static getProximityCostFunction(
    gameState: IGameState,
    gameData: IGameData,
    options: PathFindingOptions,
  ): CostFunction {
    return (
      from: ILocationIdentifier,
      to: ILocationIdentifier,
      edgeType: EdgeType,
      throughSeaLocation?: string, // special handling for "through_sea" edges
    ) => {
      const rule = gameData.proximityComputationRule;
      const road = gameState.roads[from]?.find(
        ({ to: roadTo }) => roadTo === to,
      );
      const countryProximityBuffs = new ProximityBuffsRecord(
        rule,
        gameState.country,
      );

      if (
        !rule.throughSeaEdgeCountedAsLandProximity &&
        throughSeaLocation &&
        edgeType === "through-sea"
      ) {
        from = throughSeaLocation;
      }

      const maritimePresence =  LocationsHelper.getLocationMaritimePresence(gameData.locationDataMap[from], gameState.temporaryLocationData[from] ?? null);
      const baseCost = this.getFlatProximityCost(
        edgeType,
        rule,
        maritimePresence,
        road?.type ?? null,
        countryProximityBuffs,
      );

      logProximityComputation([from, to], options, "Base proximity cost", {
        from,
        to,
        through: { edgeType, throughSeaLocation: throughSeaLocation ?? "N/A" },
        baseCost,
      });

      const toLocationData = gameData.locationDataMap[to];
      const isToSeaZone = toLocationData.isSea;
      const isToLakeZone = toLocationData.isLake;

      // Optional: Only allow routing through unowned sea and lake zones
      // Block all other unowned locations (land, ports, etc.)
      if (
        !options.allowUnownedLocations &&
        !Object.keys(gameState.ownedLocations).includes(to) &&
        !isToSeaZone &&
        !isToLakeZone
      ) {
        return { cost: 100, through: edgeType };
      }

      const proximityModifiersSummed = this.getPercentageProximityCostModifiers(
        from,
        to,
        edgeType,
        gameData,
        gameState,
        countryProximityBuffs,
        options,
        road?.type ?? null,
      );


      const modifiedCostWithAdditiveModifiers = baseCost * (1 - proximityModifiersSummed / 100); // pre 1.1
      const modifiedCostWithMultiplicativeModifiers = baseCost / (1 + proximityModifiersSummed / 100); // post 1.1
      /* console.log("modified cost", { baseCost, modifiedCostWithAdditiveModifiers, modifiedCostWithMultiplicativeModifiers}); */

      const modifiedCost = Math.max(
        0.1,
        rule.proximityModifiersStackingMode === "additive" ? 
          modifiedCostWithAdditiveModifiers
          : modifiedCostWithMultiplicativeModifiers,
      );

      logProximityComputation([from, to], options, "Final proximity cost", {
        from,
        to,
        edgeType,
        modifiedCost,
        proximityModifiersSummed,
      });

      return {
        cost: modifiedCost,
        through: edgeType,
      };
    };
  }

  public static getPathFromClosestProximitySource(
    target: ILocationIdentifier,
    gameState: IGameState,
    gameData: IGameData,
    adjacencyGraph: CompactGraph,
    pathfindingOptions: PathFindingOptions,
  ): {
    sourceLocation: ILocationIdentifier;
    proximity: number;
    path: NonNullable<ReturnType<typeof adjacencyGraph.getShortestPath>>;
  } | null {
    const proximitySourceLocations =
      ProximityComputationHelper.getLocalProximitySourceLocations(gameState);

    const shortestPaths: Array<{
      sourceLocation: ILocationIdentifier;
      path: NonNullable<ReturnType<typeof adjacencyGraph.getShortestPath>>;
      proximity: number;
    }> = [];

    for (const [
      proximitySourceLocationName,
      proximitySourceAmount,
    ] of Object.entries(proximitySourceLocations)) {
      const shortestPath = adjacencyGraph.getShortestPath(
        proximitySourceLocationName,
        target,
        proximitySourceAmount,
        ProximityComputationHelper.getProximityCostFunction(
          gameState,
          gameData,
          pathfindingOptions,
        ),
      );
      if (shortestPath) {
        shortestPaths.push({
          sourceLocation: proximitySourceLocationName as ILocationIdentifier,
          proximity: proximitySourceAmount,
          path: shortestPath,
        });
      }
    }

    if (shortestPaths.length === 0) {
      return null;
    }

    shortestPaths.sort((a, b) => {
      const totalCostA = a.path.reduce((acc, step) => acc + step.cost, 0);
      const totalCostB = b.path.reduce((acc, step) => acc + step.cost, 0);
      const scoreA = a.proximity - totalCostA;
      const scoreB = b.proximity - totalCostB;
      return scoreB - scoreA;
    });

    return shortestPaths[0];
  }

  public static getGameStateProximityComputation = (
    gameState: IGameState,
    gameData: IGameData,
    adjacencyGraph: CompactGraph,
    options: PathFindingOptions,
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
    options: PathFindingOptions,
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
