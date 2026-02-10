"use client";

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

  private buildHierarchyGroups(): Record<
    keyof ILocationGameData["hierarchy"],
    Map<
      string,
      {
        hierarchy: ILocationGameData["hierarchy"];
        locations: ILocationIdentifier[];
      }
    >
  > {
    const groups = {} as Record<
      keyof ILocationGameData["hierarchy"],
      Map<
        string,
        {
          hierarchy: ILocationGameData["hierarchy"];
          locations: ILocationIdentifier[];
        }
      >
    >;

    if (!this.gameData) return groups;

    for (const [locationName, { hierarchy }] of Object.entries(
      this.gameData.locationDataMap,
    )) {
      for (const hierarchyType of Object.keys(hierarchy) as Array<
        keyof ILocationGameData["hierarchy"]
      >) {
        const value = this.formatName(hierarchy[hierarchyType]);
        if (!value) continue;

        let typeMap = groups[hierarchyType];
        if (!typeMap) {
          typeMap = new Map();
          groups[hierarchyType] = typeMap;
        }

        let entry = typeMap.get(value);
        if (!entry) {
          entry = {
            hierarchy,
            locations: [],
          };
          typeMap.set(value, entry);
        }
        entry.locations.push(this.formatName(locationName) as ILocationIdentifier);
      }
    }

    return groups;
  }

  private getNonProvinceHierarchyMatches(
    query: string,
  ): ILocationSearchResult[] {
    if (!this.gameData) return [];
    const nonProvinceHierarchyMatches: ILocationSearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    const groups = this.buildHierarchyGroups();

    for (const [hierarchyType, typeMap] of Object.entries(groups) as [
      keyof ILocationGameData["hierarchy"],
      Map<
        string,
        {
          hierarchy: ILocationGameData["hierarchy"];
          locations: ILocationIdentifier[];
        }
      >,
    ][]) {
      for (const [value, { hierarchy, locations }] of typeMap.entries()) {
        if (!value.toLowerCase().includes(lowerQuery)) continue;

        nonProvinceHierarchyMatches.push({
          locations: [
            {
              name: value,
              hierarchyType,
              hierarchy,
              locationsInHierarchy: locations,
            },
          ],
        });

        if (nonProvinceHierarchyMatches.length >= 3) {
          return nonProvinceHierarchyMatches;
        }
      }
    }

    return nonProvinceHierarchyMatches;
  }

  private formatName(name: string): string {
    return name
      .replaceAll("_province", "")
      .replaceAll("_area", "")
      .replaceAll("_region", "")
      .replaceAll("_", " ")
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
      .map(([name, data]) => ({
        name: this.formatName(name),
        hierarchyType: "location" as const,
        hierarchy: data.hierarchy,
        locationsInHierarchy: [name],
      }))
      .filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, this.maxResults)

    if (locations.length < 3) {
      // add other hierarchy matches
      const nonProvinceHierarchyMatches =
        this.getNonProvinceHierarchyMatches(query);
      locations.push(
        ...nonProvinceHierarchyMatches.flatMap((match) => match.locations),
      );
    }
    this.subject = { locations };
    this.notifyListeners();
  }
}

export const locationSearchController = new LocationSearchController();
