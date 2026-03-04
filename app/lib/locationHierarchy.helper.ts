import { HierarchyRecord } from "@/app/lib/locationHierarchy.service";
import { ObjectHelper } from "@/app/lib/object.helper";
import { ILocationDataMap } from "@/app/lib/types/general";

export class LocationHierarchyHelper {
  public static buildHierarchyGroups(
    locationDataMap: ILocationDataMap,
  ): HierarchyRecord {
    const groups: HierarchyRecord = {
      continent: {},
      subcontinent: {},
      region: {},
      area: {},
      province: {},
    };
    for (const [locationName, { hierarchy }] of Object.entries(
      locationDataMap,
    )) {
      for (const [hierarchyType] of ObjectHelper.getTypedEntries(hierarchy)) {
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
