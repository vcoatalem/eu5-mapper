import { Observable } from "./observable";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
} from "./types/general";
import { gameStateController } from "@/app/lib/gameStateController";
import { CostFunction } from "./types/pathfinding";
import { CompactGraph } from "./graph";
import { ConstructibleHelper } from "./constructibleHelper";

export interface IProximityComputationResults {
  proximityCostsForCapital: Map<ILocationIdentifier, number>; //TODO : not a fan of map, lets change graph to use Record
}

export class ProximityComputationController extends Observable<IProximityComputationResults> {
  private gameData: IGameData | null = null;
  private adjacencyGraph: CompactGraph | null = null;

  private locationNaturalLocalProximityCostReductionMap: Record<
    ILocationIdentifier,
    number
  > = {};

  constructor() {
    super();
  }

  public init(gameData: IGameData, adjacencyGraph: CompactGraph): void {
    console.log("[proximityComputationController] init");
    this.gameData = gameData;
    this.adjacencyGraph = adjacencyGraph;
    this.subject = {
      proximityCostsForCapital: new Map(),
    };
    gameStateController.subscribe((gameState) => {
      if (!this.adjacencyGraph) {
        throw new Error(
          "[ProximityComputationController] no adjacency graph set",
        );
      }
      const proximitySourceLocations =
        ConstructibleHelper.getLocalProximitySourceLocations(gameState);

      if (Object.keys(proximitySourceLocations).length === 0) {
        console.warn(
          "can not compute proximity costs: no proximity source locations",
        );
        return;
      }

      const locationsResults: Record<
        ILocationIdentifier,
        Map<string, number>
      > = {};

      for (const [locationName, proximitySource] of Object.entries(
        proximitySourceLocations,
      )) {
        locationsResults[locationName] =
          this.adjacencyGraph.reachableWithinCost(
            locationName,
            proximitySource,
            this.getProximityCostFunction(gameState),
          );
      }

      const mergedResults: Map<string, number> = new Map();
      for (const [location, resultMap] of Object.entries(locationsResults)) {
        for (const [target, cost] of resultMap.entries()) {
          const deducedCost = 100 - proximitySourceLocations[location] + cost;
          if (
            !mergedResults.has(target) ||
            deducedCost < mergedResults.get(target)!
          ) {
            mergedResults.set(target, deducedCost);
          }
        }
      }

      this.subject.proximityCostsForCapital = mergedResults;
      this.notifyListeners();
    });
  }

  private getEnvironmentalProximityCostIncreasePercentage = (
    location: ILocationGameData,
  ): number => {
    if (!this.gameData) {
      throw new Error(
        "[ProximityComputationController] gameData not initialized",
      );
    }

    if (
      this.locationNaturalLocalProximityCostReductionMap[location.name] !==
      undefined
    ) {
      return this.locationNaturalLocalProximityCostReductionMap[location.name];
    }

    const rule = this.gameData.proximityComputationRule;

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

    this.locationNaturalLocalProximityCostReductionMap[location.name] =
      totalEnvironmentalCostIncrease;
    return totalEnvironmentalCostIncrease;
  };

  private getLocationProximityLocalCostReductionPercentage = (
    location: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
  ): number => {
    if (!this.gameData) {
      throw new Error(
        "[ProximityComputationController] gameData not initialized",
      );
    }
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
      this.getEnvironmentalProximityCostIncreasePercentage(location);

    const development = location.development; // todo: use temporary value instead, to allow user modifying dev values
    const developmentCostReduction =
      development * this.gameData.proximityComputationRule.developmentImpact;

    const total =
      // positive proximity (cost reduction)
      totalBuildingsCostReduction +
      developmentCostReduction -
      // negative proximity (cost increase)
      environmentalProximityCostIncreasePercentage;
    return total;
  };

  private getLocationHarborCapacity = (
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

  public getProximityCostFunction(gameState: IGameState): CostFunction {
    if (!this.gameData) {
      throw new Error(
        "[ProximityComputationController] gameData not initialized",
      );
    }
    return (
      from: ILocationIdentifier,
      to: ILocationIdentifier,
      isRiver: boolean,
      isLand: boolean,
      isSea: boolean,
      isPort: boolean,
      isLake: boolean,
    ) => {
      const rule = this.gameData!.proximityComputationRule;

      /*  console.log("enter proximity cost function", {
        from,
        to,
        through: { isRiver, isLand, isSea, isPort, isLake },
        context: this.gameData,
        gameState,
      }); */

      const toLocationData = this.gameData!.locationDataMap[to];
      const isToSeaZone = toLocationData.isSea;
      const isToLakeZone = toLocationData.isLake;

      // Only allow routing through unowned sea and lake zones
      // Block all other unowned locations (land, ports, etc.)
      if (
        !Object.keys(gameState.ownedLocations).includes(to) &&
        !isToSeaZone &&
        !isToLakeZone
      ) {
        return 100;
      }

      if (isToLakeZone) {
        return 5; //TODO: make this proper
      }

      const baseCost = isRiver
        ? rule.baseCost - rule.riverCostReduction
        : rule.baseCost;

      // Only calculate proximity cost reduction for owned locations
      const localProximityCostReductionPercentage = gameState.ownedLocations[
        from
      ]
        ? this.getLocationProximityLocalCostReductionPercentage(
            this.gameData!.locationDataMap[from],
            gameState.ownedLocations[from],
          )
        : 0;
      let modifiedCost =
        baseCost * (1 - localProximityCostReductionPercentage / 100);

      /*    if (from === "calais" && to === "dunkirk") {
        console.log("modified cost", modifiedCost);
      } */

      if (isPort) {
        // TODO: hypothesis to confirm: harbor capacity is applied, whether going IN or OUT of a port
        const locationWithHarbor = isToSeaZone ? from : to;
        if (!gameState.ownedLocations[locationWithHarbor]) {
          return 0; // we dont use other peoples harbors
        }
        const harborCapacity = this.getLocationHarborCapacity(
          this.gameData!.locationDataMap[locationWithHarbor],
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

      return modifiedCost;
    };
  }
}

export const proximityComputationController =
  new ProximityComputationController();
