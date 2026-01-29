"use client";

import { ConstructibleHelper } from "./constructibleHelper";
import { Observable } from "./observable";
import { IConstructibleLocation, IGameData, IGameState } from "./types/general";

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

  public selectLocation(locationName: string): boolean {
    if (!this.subject) return false;
    const storedLocation = this.subject.ownedLocations[locationName];
    if (!storedLocation) {
      this.acquireLocation(locationName);
    } else {
      this.abandonLocation(locationName);
    }
    return !storedLocation;
  }

  public acquireLocation(locationName: string): void {
    this.subject.ownedLocations[locationName] = {
      level: "rural", // TODO: get location base level
      buildings: [], // TODO: get location base buildings
    };
    if (!this.subject.capitalLocation) {
      this.subject.capitalLocation = locationName;
    }
    console.log("game state controller will notify listeners...");
    this.notifyListeners();
  }

  public abandonLocation(locationName: string): void {
    delete this.subject.ownedLocations[locationName];
    if (this.subject.capitalLocation === locationName) {
      this.subject.capitalLocation =
        Object.keys(this.subject.ownedLocations)?.[0] ?? null;
    }
    this.notifyListeners();
  }

  public changeCapital(locationName: string): void {
    if (!this.subject.ownedLocations[locationName]) {
      throw new Error(
        `Cannot set capital to unowned location: ${locationName}`,
      );
    }
    this.subject.capitalLocation = locationName;
    this.notifyListeners();
  }

  public changeLocationRank(
    locationName: string,
    newRank: IConstructibleLocation["level"],
  ): void {
    const location = this.subject.ownedLocations[locationName];
    if (!location) {
      throw new Error(
        `Cannot change rank of unowned location: ${locationName}`,
      );
    }
    location.level = newRank;

    let buildingToKeep: string[] = [];
    for (const building of location.buildings) {
      const { reason } = ConstructibleHelper.getBuildability(
        building.template,
        locationName,
        this.gameData!,
        this.subject.ownedLocations,
      );
      if (reason !== "restriction") {
        buildingToKeep.push(building.template.name);
      }
    }
    this.subject.ownedLocations[locationName].buildings =
      location.buildings.filter((b) =>
        buildingToKeep.includes(b.template.name),
      );
    this.notifyListeners();
  }

  public addBuildingToLocation(
    locationName: string,
    buildingName: string,
  ): void {
    {
      const location = this.subject.ownedLocations[locationName];
      if (!location) {
        throw new Error(
          `Cannot add building to unowned location: ${locationName}`,
        );
      }
      const buildingTemplate =
        this.gameData?.buildingsTemplateMap[buildingName];
      if (!buildingTemplate) {
        throw new Error(`Unknown building template: ${buildingName}`);
      }

      const { canBuild, reason } = ConstructibleHelper.getBuildability(
        buildingTemplate,
        locationName,
        this.gameData!,
        this.subject.ownedLocations,
      );

      if (!canBuild) {
        throw new Error(
          `Cannot build ${buildingName} at location: ${locationName} (${reason})`,
        );
      }

      const buildingToUpgrade = location.buildings.filter(
        (b) => b.template.name === buildingName,
      );
      const buildingToUpgradeIdx = location.buildings.indexOf(
        buildingToUpgrade[0],
      );
      if (buildingToUpgradeIdx !== -1) {
        this.subject.ownedLocations[locationName].buildings[
          buildingToUpgradeIdx
        ].level += 1;
      } else {
        const buildingToCreate = {
          template: buildingTemplate,
          level: 1,
          createdByUser: true,
        };
        this.subject.ownedLocations[locationName].buildings.push(
          buildingToCreate,
        );
      }
      this.notifyListeners();
    }
  }

  public removeBuildingFromLocation(
    locationName: string,
    buildingName: string,
  ): void {
    const location = this.subject.ownedLocations[locationName];
    const building = location.buildings.find(
      (b) => b.template.name === buildingName,
    );
    if (!building) {
      throw new Error(
        `Cannot remove non-existing building ${buildingName} at location: ${locationName}`,
      );
    }
    const buildingIdx = location.buildings.indexOf(building);
    if (building.level > 1) {
      this.subject.ownedLocations[locationName].buildings[buildingIdx].level -=
        1;
      this.notifyListeners();
    } else {
      this.subject.ownedLocations[locationName].buildings.splice(
        buildingIdx,
        1,
      );
      this.notifyListeners();
    }
  }
}
export const gameStateController = new GameStateController();
