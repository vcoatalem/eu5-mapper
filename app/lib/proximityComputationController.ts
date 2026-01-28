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

interface ProximityComputationResults {
  proximityCostsForCapital: Map<ILocationIdentifier, number>; //TODO : not a fan of map, lets change graph to use Record
}

export class ProximityComputationController extends Observable<ProximityComputationResults> {
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
      console.log({ gameState });
      if (!this.adjacencyGraph) {
        throw new Error(
          "[ProximityComputationController] no adjacency graph set",
        );
      }
      const capitalLocation = gameState.capitalLocation;
      if (!capitalLocation) {
        console.warn("can not compute proximity costs: no capital set");
        return;
      }

      const reachable = this.adjacencyGraph.reachableWithinCost(
        capitalLocation,
        100,
        this.getProximityCostFunction(gameState),
      );

      this.subject.proximityCostsForCapital = reachable;
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
      .map((b) => b.template.proximityCostReductionPercentage[b.level - 1])
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
    const naturalHarborSuitability = locationData.naturalHarborSuitability;

    const buildings = locationConstructibleData.buildings ?? [];
    const totalBuildingsHarborCapacity = buildings
      .map((b) => b.template.harborCapacity[b.level - 1])
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

      console.log("enter proximity cost function", {
        context: this.gameData,
        gameState,
      });

      if (!Object.keys(gameState.ownedLocations).includes(from) && !isSea) {
        // this is not entirely exact, in some situations you can pass over foreign territory but this is close enough for now
        return 100;
      }
      if (isLake) {
        return 5; //TODO: make this proper
      }

      const baseCost = isRiver
        ? rule.baseCost - rule.riverCostReduction
        : rule.baseCost;

      const localProximityCostReductionPercentage =
        this.getLocationProximityLocalCostReductionPercentage(
          this.gameData!.locationDataMap[from],
          gameState.ownedLocations[from],
        );
      let modifiedCost =
        baseCost * (1 - localProximityCostReductionPercentage / 100);

      if (isPort) {
        const harborCapacity = this.getLocationHarborCapacity(
          this.gameData!.locationDataMap[from],
          gameState.ownedLocations[from],
        );
        modifiedCost =
          modifiedCost *
          (1 - (rule.harborCapacityImpact * harborCapacity) / 100);
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
