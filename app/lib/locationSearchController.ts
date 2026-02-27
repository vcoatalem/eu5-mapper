"use client";

import { LocationHierarchyService } from "@/app/lib/locationHierarchy.service";
import { Observable } from "./observable";
import {
  IGameData,
  ILocationGameData,
  ILocationIdentifier,
} from "./types/general";

export interface ILocationSearchResult {
  locations: Array<{
    name: string;
    hierarchyType: keyof ILocationGameData["hierarchy"] | "location";
    hierarchy: ILocationGameData["hierarchy"];
    locationsInHierarchy: ILocationIdentifier[];
  }>;
}

export class LocationSearchController extends Observable<ILocationSearchResult> {
  private gameData: IGameData | null = null;
  private maxResults: number = 10;

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

  public async search(query: string): Promise<void> {
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
      .map(([name, data]) => ({
        name: name,
        hierarchyType: "location" as const,
        hierarchy: data.hierarchy,
        locationsInHierarchy: [name],
      }))
      .filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, this.maxResults);

    if (locations.length < 5) {
      const nonLocationHierarchyMatches =
        await LocationHierarchyService.getNonLocationHierarchyMatches(query);
      locations.push(
        ...nonLocationHierarchyMatches
          .flatMap((match) => match.locations)
          .filter((loc) => loc.hierarchyType !== "continent"), //exclude continents for now, to avoid performance issues in client
      );
    }
    this.subject = { locations };
    this.notifyListeners();
  }
}

export const locationSearchController = new LocationSearchController();
