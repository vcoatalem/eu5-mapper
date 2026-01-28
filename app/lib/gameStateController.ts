"use client";

import { Observable } from "./observable";
import {
  ILocationIdentifier,
  IGameData,
  ILocationGameData,
  IGameState,
} from "./types/general";
import { CostFunction } from "./types/pathfinding";

class GameStateController extends Observable<IGameState> {
  private gameData: IGameData | null = null;

  constructor() {
    super();
    this.subject = {} as IGameState;
  }

  public init(gameData: IGameData): void {
    this.gameData = gameData;
    this.subject = {
      country: "",
      roads: {},
      ownedLocations: {},
    };
    this.notifyListeners();
  }

  public findLocationName(hexColor: string): string {
    const name = this.gameData?.colorToNameMap[hexColor];
    if (!name) {
      console.log("could not find name for color", hexColor);
      return "??";
    }
    return name ?? "??";
  }

  private updateGameState(): void {
    this.notifyListeners();
  }

  public selectLocation(locationName: string): boolean {
    if (!this.subject) return false;

    const storedLocation = this.subject.ownedLocations[locationName];
    if (!storedLocation) {
      this.subject.ownedLocations[locationName] = {
        level: "rural",
        buildings: [],
      };
    } else {
      delete this.subject.ownedLocations[locationName];
    }
    this.updateGameState();
    return !storedLocation;
  }

  // this might be calculated only once and stored in location data
  private getTopographyProximityCostIncreasePercentage(
    topography: ILocationGameData["topography"],
  ): number {
    switch (topography) {
      case "flatlands":
        return 0;
      case "hills":
        return 25;
      case "wetlands":
        return 25;
      case "mountains":
        return 50;
      case "plateau":
        return 12.5;
      case "lakes":
      case "ocean":
      case "coastal_ocean":
      case "narrows":
      case "inland_sea":
      case "ocean_wasteland":
      case "mountain_wasteland":
      case "unknown":
      default:
        return -1;
    }
  }

  // this might be calculated only once and store in location data
  private getVegetationProximityCostIncreasePercentage = (
    vegetation: ILocationGameData["vegetation"],
  ): number => {
    switch (vegetation) {
      case "forest":
        return 25;
      case "woods":
        return 12.5;
      case "jungle":
        return 50;
      case "desert":
        return 5;
      case "sparse":
      case "grassland":
      default:
        return 0;
    }
  };

  // it could be interesting to cache these values and recompute whenever ownedLocations or buildings change
  private getLocationProximityLocalCostReductionPercentage = (
    location: ILocationIdentifier,
  ): number => {
    // [] is temporary fix to avoid error
    const buildings = this.subject?.ownedLocations[location]?.buildings ?? [];
    const totalBuildingsCostReduction = buildings
      .map((b) => b.template.proximityCostReductionPercentage[b.level - 1])
      .reduce((a, b) => a + b, 0);

    const totalEnvironmentalCostIncrease =
      this.getTopographyProximityCostIncreasePercentage(
        this.gameData!.locationDataMap[location].topography,
      ) +
      this.getVegetationProximityCostIncreasePercentage(
        this.gameData!.locationDataMap[location].vegetation,
      );

    const development = 25; // todo: store actual dev on location
    const developmentCostReduction = development / 5;

    return (
      totalBuildingsCostReduction -
      totalEnvironmentalCostIncrease -
      developmentCostReduction
    );
  };

  private getLocationHarborCapacity = (
    location: ILocationIdentifier,
  ): number => {
    const naturalHarborSuitability = 25; // todo: store this info in data

    const buildings = this.subject?.ownedLocations[location]?.buildings ?? [];
    const totalBuildingsHarborCapacity = buildings
      .map((b) => b.template.harborCapacity[b.level - 1])
      .reduce((a, b) => a + b, 0);

    return naturalHarborSuitability + totalBuildingsHarborCapacity;
  };

  public proximityCostFunction: CostFunction = (
    from: ILocationIdentifier,
    to: ILocationIdentifier,
    isRiver: boolean,
    isLand: boolean,
    isSea: boolean,
    isPort: boolean,
    isLake: boolean,
  ) => {
    if (isLake) {
      return 5;
    }

    let baseCost = 40;
    if (isRiver) {
      baseCost = 10;
    }

    const localProximityCostReductionPercentage =
      this.getLocationProximityLocalCostReductionPercentage(from);
    let modifiedCost =
      baseCost * (1 - localProximityCostReductionPercentage / 100);

    if (isPort) {
      const harborSuitability = this.getLocationHarborCapacity(from);
      modifiedCost = modifiedCost * (1 - ((3 / 4) * harborSuitability) / 100);
    }

    if (isSea) {
      // maritime presence calculation
      // for now, we will assume maritime presence 50% everywhere
      const maritimePresence = 0.5;
      modifiedCost = modifiedCost * (1 - maritimePresence);
    }

    return modifiedCost;
  };

  // note : all proximity calculations should be made into a separate class, that subscribes to changes owned location (game state)

  // we could rename game logic controller -> game state controller to reinforce this idea
}

export const gameStateController = new GameStateController();
