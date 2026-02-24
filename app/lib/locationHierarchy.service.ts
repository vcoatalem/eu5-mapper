import { ILocationSearchResult } from "@/app/lib/locationSearchController";
import { ILocationDataMap, ILocationGameData, ILocationIdentifier } from "@/app/lib/types/general";
import { IndexedDBReader } from "@/app/lib/indexeddb/indexeddb-reader";
import { IndexedDBWriter } from "@/app/lib/indexeddb/indexeddb-writer";
import {
  dbDataKey,
  dbLocationHierarchyStoreName,
  dbName,
  dbStoreNames,
  dbVersion,
} from "@/app/lib/indexeddb/indexeddb.const";
import { StringHelper } from "@/app/lib/utils/string.helper";

export type ILocationHierarchy = Record<
  keyof ILocationGameData["hierarchy"],
  Record<
    string,
    {
      hierarchy: ILocationGameData["hierarchy"];
      locations: ILocationIdentifier[];
    }
  >
>;

export class LocationHierarchyService {
  /** Call once on startup to persist hierarchy groups to IndexedDB. */
  public static async persistToIndexedDB(
    locationDataMap: ILocationDataMap,
  ): Promise<void> {
    const hierarchyGroups = this.buildHierarchyGroups(locationDataMap);
    const writer = new IndexedDBWriter(dbName, dbVersion, dbStoreNames);
    await writer.open();
    await writer.put(
      dbLocationHierarchyStoreName,
      dbDataKey,
      hierarchyGroups,
    );
  }

  private static async getFromIndexedDB(): Promise<ILocationHierarchy> {
    const reader = new IndexedDBReader(dbName, dbVersion, dbStoreNames);
    const data = await reader.get(dbLocationHierarchyStoreName, dbDataKey);
    return data ?? {};
  }

  private static buildHierarchyGroups(
    locationDataMap: ILocationDataMap,
  ): ILocationHierarchy {
    const groups = {} as ILocationHierarchy;
    for (const [locationName, { hierarchy }] of Object.entries(
      locationDataMap,
    )) {
      for (const hierarchyType of Object.keys(hierarchy) as Array<
        keyof ILocationGameData["hierarchy"]
      >) {
        const value = hierarchy[hierarchyType];
        if (!value) continue;

        let typeMap = groups[hierarchyType];
        if (!typeMap) {
          typeMap = {};
          groups[hierarchyType] = typeMap;
        }

        let entry = typeMap[value];
        if (!entry) {
          entry = {
            hierarchy,
            locations: [],
          };
          typeMap[value] = entry;
        }
        entry.locations.push(locationName);
      }
    }

    return groups;
  }

  public static async getNonLocationHierarchyMatches(
    query: string,
  ): Promise<ILocationSearchResult[]> {
    const hierarchyGroups = await this.getFromIndexedDB();

    const nonProvinceHierarchyMatches: ILocationSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [hierarchyType, typeMap] of Object.entries(hierarchyGroups)) {
      for (const [value, { hierarchy, locations }] of Object.entries(
        typeMap,
      )) {
        if (!StringHelper.isInSearchQuery(value, lowerQuery)) continue;
        nonProvinceHierarchyMatches.push({
          locations: [
            {
              name: value,
              hierarchyType: hierarchyType as keyof ILocationGameData["hierarchy"],
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

  public static async getAllLocationsInHierarchy(
    hierarchyType: keyof ILocationGameData["hierarchy"],
    hierarchyValue: string,
  ): Promise<ILocationIdentifier[]> {
    const hierarchyGroups = await this.getFromIndexedDB();
    const entry = hierarchyGroups[hierarchyType]?.[hierarchyValue];
    return entry?.locations ?? [];
  }
}
