import { IndexedDBReader } from "@/app/lib/indexeddb/indexeddb-reader";
import { IndexedDBWriter } from "@/app/lib/indexeddb/indexeddb-writer";
import {
  dbDataKey,
  dbLocationHierarchyStoreName,
  dbName,
  dbStoreNames,
  dbVersion,
} from "@/app/lib/indexeddb/indexeddb.const";
import { LocationHierarchyHelper } from "@/app/lib/locationHierarchy.helper";
import { ILocationSearchResult } from "@/app/lib/locationSearch.model";
import { LocationIdentifier } from "@/app/lib/types/general";
import { LocationGameDataMap } from "@/app/lib/types/location";
import { ILocationHierarchy } from "@/app/lib/types/locationHierarchy";
import { StringHelper } from "@/app/lib/utils/string.helper";

const HIERARCHY_ITEM_KEY_SEP = "\u001e";

function hierarchyItemKey(
  hierarchyType: keyof ILocationHierarchy,
  hierarchyValue: string,
): string {
  return `${hierarchyType}${HIERARCHY_ITEM_KEY_SEP}${hierarchyValue}`;
}

export type HierarchyRecord = Record<
  keyof ILocationHierarchy,
  Record<
    string,
    {
      hierarchy: ILocationHierarchy;
      locations: LocationIdentifier[];
    }
  >
>;

export class LocationHierarchyService {
  /** Call once on startup to persist hierarchy groups to IndexedDB. */
  public static async persistToIndexedDB(
    locationDataMap: LocationGameDataMap,
  ): Promise<void> {
    const hierarchyGroups =
      LocationHierarchyHelper.buildHierarchyGroups(locationDataMap);
    const writer = new IndexedDBWriter(dbName, dbVersion, dbStoreNames);
    await writer.open();

    await writer.put(dbLocationHierarchyStoreName, dbDataKey, hierarchyGroups);

    for (const [hierarchyType, typeMap] of Object.entries(hierarchyGroups)) {
      for (const [value, entry] of Object.entries(typeMap)) {
        await writer.put(
          dbLocationHierarchyStoreName,
          hierarchyItemKey(hierarchyType as keyof ILocationHierarchy, value),
          entry,
        );
      }
    }
  }

  private static async getFromIndexedDB(): Promise<HierarchyRecord> {
    const reader = new IndexedDBReader(dbName, dbVersion);
    const data = await reader.get(dbLocationHierarchyStoreName, dbDataKey);
    return data as HierarchyRecord ?? {};
  }

  public static async getNonLocationHierarchyMatches(
    query: string,
  ): Promise<ILocationSearchResult[]> {
    const hierarchyGroups = await this.getFromIndexedDB();

    const nonProvinceHierarchyMatches: ILocationSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [hierarchyType, typeMap] of Object.entries(hierarchyGroups)) {
      for (const [value, { hierarchy, locations }] of Object.entries(typeMap)) {
        if (!StringHelper.isInSearchQuery(value, lowerQuery)) continue;
        nonProvinceHierarchyMatches.push({
          locations: [
            {
              name: value,
              hierarchyType: hierarchyType as keyof ILocationHierarchy,
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
    hierarchyType: keyof ILocationHierarchy,
    hierarchyValue: string,
  ): Promise<LocationIdentifier[]> {
    const reader = new IndexedDBReader(dbName, dbVersion);
    const entry = await reader.get(
      dbLocationHierarchyStoreName,
      hierarchyItemKey(hierarchyType, hierarchyValue),
    ) as { locations: LocationIdentifier[] } | undefined;
    return entry?.locations ?? [];
  }
}
