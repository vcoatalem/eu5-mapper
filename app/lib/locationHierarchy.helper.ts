import { HierarchyRecord } from "@/app/lib/locationHierarchy.service";
import { ILocationDataMap, ILocationGameData } from "@/app/lib/types/general";

export class LocationHierarchyHelper {

  public static buildHierarchyGroups(
    locationDataMap: ILocationDataMap,
  ): HierarchyRecord {
    const groups = {} as HierarchyRecord;
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
}