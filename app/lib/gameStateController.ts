"use client";

import { Observable } from "./observable";
import { IGameData, IGameState } from "./types/general";

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
}
export const gameStateController = new GameStateController();
