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
  EdgeType,
  PathFindingOptions,
  PathfindingResult,
} from "./types/pathfinding";
import { IProximityComputationRule } from "./types/proximityComputationRules";

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
    gameData: IGameData,
    country: ICountryValues,
    behaviour: {
      discardVegetationModifiers: boolean;
      discardVegetationAndTopographyModifiers: boolean;
    },
    options: PathFindingOptions,
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
      behaviour.discardVegetationAndTopographyModifiers
        ? 0
        : ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage(
            location,
            gameData,
            behaviour.discardVegetationModifiers, // road
            options,
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
      // advances, estate privileges, etc.
    ];
    const countryLandProximityReduction = countryLandProximityModifiers.reduce(
      (a, b) => a + b,
      0,
    );

    logProximityComputation(
      location.name,
      options,
      "Land location proximity modifiers",
      {
        totalBuildingsCostReduction,
        countryLandProximityReduction,
        developmentCostReduction,
        environmentalProximityCostIncreasePercentage,
      },
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
    options: PathFindingOptions,
  ): number => {
    logProximityComputation(
      locationData.name,
      options,
      "Enter location harbor capacity calculation",
      { locationConstructibleData },
    );
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

    logProximityComputation(locationData.name, options, "Harbor capacity", {
      locationConstructibleData,
      totalBuildingsHarborCapacity,
      naturalHarborSuitability,
    });
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

    if (!isNaval) {
      const landFlatCostReduction = [
        isImpactedByRoad && roadToDestination
          ? rule.roadProximityCostReduction[roadToDestination]
          : 0,
        // TODO: advances, policies, etc. providing flat reduction to land proximity
      ].reduce((a, b) => a + b, 0);
      return baseCost - landFlatCostReduction;
    } else {
      const navalValueProximityCostReduction =
        gameState.country.landVsNaval > 0
          ? (rule.valuesImpact.landVsNaval[1].flatModifier *
              gameState.country.landVsNaval) /
            100
          : 0;
      // Normalize maritimePresence to [0,1]
      let normalizedMaritimePresence =
        edgeType === "lake" ? 1 : maritimePresence / 100;
      normalizedMaritimePresence = Math.max(
        0,
        Math.min(1, normalizedMaritimePresence),
      );

      const flatProximityCostWithoutMaritimePresence = [
        // ... advances, policies, etc. providing flat reduction to naval proximity without maritime presence
      ].reduce((a, b) => a + b, 0);

      const flatProximityCostWithMaritimePresence = [
        navalValueProximityCostReduction,
        // ... advances, policies, etc. providing flat reduction to naval proximity with maritime presence
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
    transportationMode: "land" | "naval" | "harbor" | "coastal",
    gameData: IGameData,
    gameState: IGameState,
    roadType: RoadType | null,
    options: PathFindingOptions,
  ): number {
    switch (transportationMode) {
      case "land":
        if (from in gameState.ownedLocations || options.allowUnownedLocations) {
          return ProximityComputationHelper.getLandLocationProximityModifiers(
            gameData.locationDataMap[from],
            gameState.ownedLocations[from],
            gameData,
            gameState.country,
            {
              discardVegetationModifiers: !!roadType,
              discardVegetationAndTopographyModifiers: false,
            },
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
          ProximityComputationHelper.getLocationHarborCapacity(
            gameData.locationDataMap[locationWithHarbor],
            gameState.ownedLocations[locationWithHarbor],
            options,
          );
        const harborImpact =
          gameData.proximityComputationRule.harborCapacityImpact;

        const harborCapacityModifier = harborCapacity * harborImpact * 100;
        /* const proximityModifier = harborImpact * harborCapacity * 100; */

        if (fromLocation.isSea) {
          return harborCapacityModifier;
        } else {
          // when going OUT from harbor, also apply land location proximity modifiers
          const harborLocationProximityModifiers =
            ProximityComputationHelper.getLandLocationProximityModifiers(
              gameData.locationDataMap[locationWithHarbor],
              gameState.ownedLocations[locationWithHarbor],
              gameData,
              gameState.country,
              {
                discardVegetationAndTopographyModifiers: true,
                discardVegetationModifiers: true,
              },
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
    options: PathFindingOptions,
    roadType: RoadType | null,
  ): number {
    const rule = gameData.proximityComputationRule;
    const modifiers: number[] = [];

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

    modifiers.push(
      this.getTransportationModeProximityCostModifiers(
        from,
        to,
        transportationMode,
        gameData,
        gameState,
        roadType,
        options,
      ),
      // generic proximity modifiers go here
      this.getGenericCountryProximityCostModifiers(
        gameState.country,
        gameData.proximityComputationRule,
      ),
    );

    logProximityComputation([from, to], options, "Proximity cost modifiers", {
      from,
      to,
      isNaval,
      modifiers,
    });

    return modifiers.reduce((a, b) => a + b, 0);
  }

  private static getMaritimePresenceAtLocation(
    gameData: IGameData,
    location: ILocationIdentifier,
  ): number {
    // TODO: allow gameState to store override for specific locations
    if (gameData.locationDataMap[location].topography === "ocean") {
      return 0;
    }
    return 50;
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

      if (
        !rule.throughSeaEdgeCountedAsLandProximity &&
        throughSeaLocation &&
        edgeType === "through-sea"
      ) {
        from = throughSeaLocation;
      }

      const maritimePresence = this.getMaritimePresenceAtLocation(
        gameData,
        from,
      );
      const baseCost = this.getFlatProximityCost(
        edgeType,
        gameState,
        rule,
        maritimePresence,
        road?.type ?? null,
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
        options,
        road?.type ?? null,
      );

      const modifiedCost = Math.max(
        0.1,
        baseCost * (1 - proximityModifiersSummed / 100),
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
