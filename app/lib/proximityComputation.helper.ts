import { CompactGraph } from "./graph";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
} from "./types/general";
import { CostFunction, PathfindingResult } from "./types/pathfinding";

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

  public static getLocationProximityLocalCostReductionPercentage = (
    location: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
    gameData: IGameData,
  ): number => {
    if (location.isSea || location.isLake) {
      return 0;
    }
    const buildings = locationConstructibleData.buildings ?? [];
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

  private static getProximityCostFunction(
    gameState: IGameState,
    gameData: IGameData,
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
      if (
        !Object.keys(gameState.ownedLocations).includes(to) &&
        !isToSeaZone &&
        !isToLakeZone
      ) {
        return { cost: 100, through: "unowned_location" };
      }

      if (isToLakeZone) {
        return { cost: 5, through: "lake" }; //TODO: make this proper
      }

      const baseCost = isRiver
        ? rule.baseCost - rule.riverCostReduction
        : rule.baseCost;

      // Only calculate proximity cost reduction for owned locations
      const localProximityCostReductionPercentage = gameState.ownedLocations[
        from
      ]
        ? ProximityComputationHelper.getLocationProximityLocalCostReductionPercentage(
            gameData.locationDataMap[from],
            gameState.ownedLocations[from],
            gameData,
          )
        : 0;
      let modifiedCost =
        baseCost * (1 - localProximityCostReductionPercentage / 100);

      if (isPort) {
        // TODO: hypothesis to confirm: harbor capacity is applied, whether going IN or OUT of a port
        const locationWithHarbor = isToSeaZone ? from : to;
        if (!gameState.ownedLocations[locationWithHarbor]) {
          return { cost: 0, through: "unowned_location" }; // we dont use other peoples harbors
        }
        const harborCapacity =
          ProximityComputationHelper.getLocationHarborCapacity(
            gameData.locationDataMap[locationWithHarbor],
            gameState.ownedLocations[locationWithHarbor],
          );

        const harborImpact = rule.harborCapacityImpact;
        const multiplier = 1 - (harborImpact * harborCapacity) / 100;

        modifiedCost = modifiedCost * multiplier;
      }

      if (isSea) {
        // maritime presence calculation
        // for now, we will assume maritime presence 50% everywhere
        const maritimePresence = 0.5;
        modifiedCost =
          modifiedCost * (1 - maritimePresence * rule.maritimePresenceImpact);
      }

      //TODO: factor in roads for land / river

      return {
        cost: modifiedCost,
        through: isRiver
          ? "river"
          : isLand
            ? "land"
            : isSea
              ? "sea"
              : isPort
                ? "port"
                : isLake
                  ? "lake"
                  : "unknown",
      };
    };
  }

  public static getGameStateProximityComputation = (
    gameState: IGameState,
    gameData: IGameData,
    adjacencyGraph: CompactGraph,
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
  ): PathfindingResult => {
    const neighbors = adjacencyGraph.reachableWithinEdges(
      location,
      1,
      ProximityComputationHelper.getProximityCostFunction(gameState, gameData),
    );

    return neighbors;
  };
}
