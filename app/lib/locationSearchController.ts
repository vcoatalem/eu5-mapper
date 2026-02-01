"use client";

import { Observable } from "./observable";
import { IGameData, ILocationGameData } from "./types/general";

interface ILocationSearchResult {
  locations: Array<{
    name: string;
    hierarchyType: keyof ILocationGameData["hierarchy"];
    hierarchy: ILocationGameData["hierarchy"];
  }>;
}

export class LocationSearchController extends Observable<ILocationSearchResult> {
  private gameData: IGameData | null = null;

  constructor() {
    super();
    this.subject = { locations: [] };
    if (typeof module !== "undefined" && (module as any).hot) {
      // HMR handle
      const latestGameData = (window as any).__latestGameData;
      if (latestGameData) {
        console.log(
          "[LocationSearchController] handle HMR for LocationSearchController",
        );
        this.init(latestGameData);
      }
    }
  }

  public init(gameData: IGameData): void {
    this.gameData = gameData;
    (window as any).__latestGameData = gameData;
  }

  public search(query: string): void {
    if (!this.gameData) {
      throw new Error("[LocationSearchController] Not initialized");
    }
    if (!query || query.trim().length === 0) {
      this.subject = { locations: [] };
      this.notifyListeners();
      return;
    }
    const locations: ILocationSearchResult["locations"] = Object.entries(
      this.gameData.locationDataMap,
    )
      .filter(([name, data]) => {
        return (
          name.toLowerCase().includes(query.toLowerCase()) && !!data.ownable
        );
      })
      .slice(0, 25)
      .map(([name, data]) => ({
        name,
        hierarchyType: "province",
        hierarchy: data.hierarchy,
      }));
    this.subject = { locations };
    this.notifyListeners();
  }
}

export const locationSearchController = new LocationSearchController();
