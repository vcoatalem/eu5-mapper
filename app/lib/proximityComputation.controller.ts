import { Observable } from "./observable";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationGameData,
  ILocationIdentifier,
} from "./types/general";
import { gameStateController } from "@/app/lib/gameState.controller";
import { CostFunction } from "./types/pathfinding";
import { CompactGraph } from "./graph";
import { ConstructibleHelper } from "./constructible.helper";
import { ProximityComputationHelper } from "./proximityComputation.helper";

export interface IProximityComputationResults {
  proximityCostsForCapital: Map<ILocationIdentifier, number>; //TODO : not a fan of map, lets change graph to use Record
}

export class ProximityComputationController extends Observable<IProximityComputationResults> {
  private gameData: IGameData | null = null;
  private adjacencyGraph: CompactGraph | null = null;

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
      if (!this.gameData) {
        throw new Error(
          "[ProximityComputationController] gameData not initialized",
        );
      }

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
        ? ProximityComputationHelper.getLocationProximityLocalCostReductionPercentage(
            this.gameData!.locationDataMap[from],
            gameState.ownedLocations[from],
            this.gameData,
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
        const harborCapacity =
          ProximityComputationHelper.getLocationHarborCapacity(
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
