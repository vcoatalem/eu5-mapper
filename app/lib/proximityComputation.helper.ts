import { BuffsHelper } from "@/app/lib/buffs.helper";
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
} from "./types/general";
import {
  CostFunction,
  EdgeType,
  PathFindingOptions,
  PathfindingResult,
} from "./types/pathfinding";
import {
  IBuffValue,
  ICountryProximityBuffs,
  IProximityComputationRule,
} from "./types/proximityComputationRules";
import { RoadType } from "@/app/lib/types/roads";

/** Only this key is applied as percentageMultiplier (cost *= 1 + value/100); all other percentage modifiers are additive (percentageIncrease). */
const HARBOR_CAPACITY_MODIFIER_KEY = "harborCapacityImpact";



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

/**
 * Result of reducing proximity modifiers by type.
 * - flatCostReduction: subtract from base cost first (positive = lower cost).
 * - percentageMultiplier: applied after cost reduction. As of 1.1.4, only harbor suitability is concernted 
 * - percentageIncrease: all other percentage modifiers summed
 */
export type ReducedProximityModifiers = {
  flatCostReduction: number;
  percentageMultiplier: number;
  percentageIncrease: number;
};


/*
* divide modifiers into flat, percentage multiplier and percentage increase
*/
export function reduceBuffValuesToEffective(
  modifiers: Record<string, IBuffValue>,
  rule: IProximityComputationRule,
): ReducedProximityModifiers {
  let flatCostReduction = 0;
  let percentageMultiplier = 1;
  let percentageIncrease = 0;

  for (const [key, v] of Object.entries(modifiers)) {
    if (v.type === "flat") {
      flatCostReduction += v.value;
      continue;
    }
    if (key === HARBOR_CAPACITY_MODIFIER_KEY && rule.harborSuitabilityIsMultiplicative) {
      percentageMultiplier *= 1 + v.value / 100;
    } else {
      percentageIncrease += v.value;
    }
  }

  return { flatCostReduction, percentageMultiplier, percentageIncrease };
}

export class ProximityComputationHelper {
  public static getEnvironmentalProximityCostIncreasePercentage = (
    location: ILocationGameData,
    gameData: IGameData,
    proximityBuffs: ProximityBuffsRecord,
    discardVegetationModifiers: boolean,
    options: PathFindingOptions,
  ): Record<string, IBuffValue> => {
    const rule = gameData.proximityComputationRule;
    const result: Record<string, IBuffValue> = {};

    const baseTopography = rule.topography[location.topography];
    let topographyValue = baseTopography?.value ?? 0;
    const buffKey = `${location.topography}Multiplier`;
    if (["mountainsMultiplier", "plateauMultiplier", "hillsMultiplier"].includes(buffKey)) {
      const buffs = proximityBuffs.getBuffsOfType(buffKey as keyof ICountryProximityBuffs);
      if (Object.keys(buffs).length > 0) {
        const buffSum = BuffsHelper.sumBuffs(Object.values(buffs)) ?? 1;
        topographyValue *= Math.min(1, buffSum / 100);
      }
    }
    result[`topography_${location.topography}`] = { ...baseTopography, value: topographyValue }

    if (location.vegetation && !discardVegetationModifiers) {
      const vegetation = rule.vegetation[location.vegetation];
      if (vegetation?.value) {
        result[`vegetation_${location.vegetation}`] = vegetation;
      }


    }

    logProximityComputation(
      location.name,
      options,
      "Environmental proximity cost increase percentage",
      { modifiers: result, discardVegetationModifiers },
    );

    return result;
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
  ): Record<string, IBuffValue> => {
    if (location.isSea || location.isLake || !location.ownable) {
      return {};
    }
    const rule = gameData.proximityComputationRule;
    const buildings = locationConstructibleData?.buildings ?? [];
    const totalBuildingModifier = Object.values(buildings)
      .map(
        (b) =>
          Math.abs(b.template.modifiers.localProximityCostModifier ?? 0) *
          100 *
          b.level,
      )
      .reduce((a, b) => a + b, 0);

    const environmental = behaviour.discardVegetationAndTopographyModifiers
      ? {}
      : ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage(
        location,
        gameData,
        proximityBuffs,
        behaviour.discardVegetationModifiers,
        options,
      );

    const development = locationTemporaryData?.development ?? location.development;
    const developmentValue = development * rule.developmentImpact.value;
    const landModifiersFromBuffs = proximityBuffs.getBuffsOfType("landModifier");

    const result: Record<string, IBuffValue> = {
      ...environmental,
      developmentImpact:
        rule.developmentImpact.type === "percentage"
          ? { type: "percentage", value: developmentValue }
          : { type: "flat", value: developmentValue },
      ...landModifiersFromBuffs,
    };
    if (totalBuildingModifier > 0) {
      result.buildingsLocalProximityCostReduction = {
        type: "percentage",
        value: totalBuildingModifier,
      };
    }

    logProximityComputation(
      location.name,
      options,
      "Land location proximity modifiers",
      { modifiers: result },
    );
    return result;
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
      const portBuffs = proximityBuffs.getBuffsOfType("portFlatCostReduction");
      const portFlatCostReduction = BuffsHelper.sumBuffs(Object.values(portBuffs)) ?? 0;
      return baseCost - portFlatCostReduction;
    }
    if (!isNaval) {
      const roadFlatCostReduction =
        isImpactedByRoad && roadToDestination
          ? rule.roadProximityCostReduction[roadToDestination]?.value ?? 0
          : 0;
      return baseCost - roadFlatCostReduction;
    } else {
      const normalizedMaritimePresence = Math.max(
        0,
        Math.min(1, maritimePresence / 100),
      );
      const seaWithout = proximityBuffs.getBuffsOfType(
        "seaWithoutMaritimeFlatCostReduction",
      );
      const seaWith = proximityBuffs.getBuffsOfType(
        "seaWithMaritimeFlatCostReduction",
      );
      const costWithoutMaritimePresence =
        rule.baseCostWithoutMaritimePresence -
        BuffsHelper.sumBuffs(Object.values(seaWithout));
      const costWithMaritimePresence =
        rule.baseCostWithMaritimePresence -
        BuffsHelper.sumBuffs(Object.values(seaWith));

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
  ): Record<string, IBuffValue> {
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
        }
        return {};
      case "harbor": {
        const rule = gameData.proximityComputationRule;
        const toLocation = gameData.locationDataMap[to];
        const fromLocation = gameData.locationDataMap[from];
        const locationWithHarbor = toLocation.isSea ? from : to;
        const harborCapacity = LocationsHelper.getLocationHarborSuitability(
          gameData.locationDataMap[locationWithHarbor],
          gameState.ownedLocations[locationWithHarbor],
        );
        const harborImpact = rule.harborSuitabilityImpact.value;
        const harborValue = harborCapacity * harborImpact * 100;
        const harborMod: Record<string, IBuffValue> = {
          [HARBOR_CAPACITY_MODIFIER_KEY]:
            { ...rule.harborSuitabilityImpact, value: harborValue }

        };

        if (fromLocation.isSea) {
          return harborMod;
        }
        const landModifiers = ProximityComputationHelper.getLandLocationProximityModifiers(
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
          "Harbor modifiers",
          { harborMod, landModifiers },
        );
        return { ...harborMod, ...landModifiers };
      }
      case "naval":
      case "coastal":
        return {};
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
  ): Record<string, IBuffValue> {
    const rule = gameData.proximityComputationRule;

    const toLocationData = gameData.locationDataMap[to];
    const isNaval = toLocationData.isSea || toLocationData.isLake;

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

    const transportationModifiers = this.getTransportationModeProximityCostModifiers(
      from,
      to,
      transportationMode,
      gameData,
      gameState,
      roadType,
      proximityBuffs,
      options,
    );
    const genericModifiers = proximityBuffs.getBuffsOfType("genericModifier");

    return { ...transportationModifiers, ...genericModifiers };
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

      const maritimePresence = LocationsHelper.getLocationMaritimePresence(gameData.locationDataMap[from], gameState.temporaryLocationData[from] ?? null);
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

      const proximityModifiers = this.getPercentageProximityCostModifiers(
        from,
        to,
        edgeType,
        gameData,
        gameState,
        countryProximityBuffs,
        options,
        road?.type ?? null,
      );

      logProximityComputation([from, to], options, "Proximity cost modifiers", {
        proximityModifiers,
      });
      const proximityModifiersReduced = reduceBuffValuesToEffective(proximityModifiers, rule);

      // Legacy additive (1.0.11): all percentage modifiers summed, then one application. New: flat, then harbor multiplicative, then rest additive.
      let cost = Math.max(0, baseCost - proximityModifiersReduced.flatCostReduction);
/*       if (rule.proximityModifiersStackingMode === "additive") {
        const effectivePercentageSum =
          (1 - proximityModifiersReduced.percentageMultiplier) * 100 +
          proximityModifiersReduced.percentageIncrease;
        cost *= Math.max(0, 1 - effectivePercentageSum / 100);
      } else { */
        cost *= proximityModifiersReduced.percentageMultiplier;
        if (rule.proximityPercentageModifierType === "proximityCostReduction") {
          cost *= 1 - proximityModifiersReduced.percentageIncrease / 100;
        } else {
          cost /= 1 + 0.01 * proximityModifiersReduced.percentageIncrease;
        }
/*       } */
      const finalCost = Math.max(0.1, cost);

      logProximityComputation([from, to], options, "Final proximity cost", {
        from,
        to,
        edgeType,
        baseCost: baseCost,
        finalCost: finalCost,
        proximityModifiers,
        proximityModifiersReduced,
      });

      return {
        cost: finalCost,
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
