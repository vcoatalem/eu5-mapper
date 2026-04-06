import {
  SaveParsingTaskResult,
  ZodSaveData,
  type SaveData,
} from "@shared/saveData";
import { JominiParser } from "./jomini";
import { taskExecutionOrder, executeTasks } from "./tasks";

export const parseSaveFile = async (
  fileContent: Uint8Array,
  onCheckpoint?: (label: string) => void,
): Promise<SaveData> => {
  const parser = JominiParser.getInstance();
  onCheckpoint?.("before_parse");
  const parsedRoot = await parser.parseRoot(fileContent);
  onCheckpoint?.("after_parse");
  const results = await executeTasks(fileContent, parsedRoot);

  // Build location index → identifier map
  const locationIndexMap: Record<number, string> = {};
  const locResult = results.locationsIndexList;
  if (locResult?.success && Array.isArray(locResult.value)) {
    locResult.value.forEach((id: string, idx: number) => {
      locationIndexMap[idx] = id;
    });
  }

  // Resolve owned location indices → identifiers
  const ownedResult = results.ownedLocations;
  const ownedLocations: string[] =
    ownedResult?.success && Array.isArray(ownedResult.value)
      ? ownedResult.value
          .map((idx: number) => locationIndexMap[idx])
          .filter((id): id is string => !!id)
      : [];

  const ownedSet = new Set(ownedLocations);

  // Build locationBuildings filtered to owned locations
  const buildingsResult = results.buildings;
  const locationBuildings: SaveData["data"]["locationBuildings"] = {};
  if (buildingsResult?.success && Array.isArray(buildingsResult.value)) {
    for (const b of buildingsResult.value) {
      const locationId = locationIndexMap[b.location];
      if (!locationId || !ownedSet.has(locationId)) continue;
      locationBuildings[locationId] = { name: b.type, level: b.level };
    }
  }

  // Serialize task results for output
  const tasks = {} as SaveData["tasks"];
  for (const name of taskExecutionOrder) {
    const r = results[name];
    const taskResult: SaveParsingTaskResult = r
      ? {
          success: r.success,
          ...(r.skipped ? { skipped: true } : {}),
          ...(!r.success && r.errors
            ? {
                error:
                  r.errors instanceof Error
                    ? r.errors.message
                    : String(r.errors),
              }
            : {}),
        }
      : { success: false, error: "task did not run" };
    tasks[name] = taskResult;
  }

  return ZodSaveData.parse({
    data: {
      version: results.version?.success ? (results.version.value ?? null) : null,
      countryCode: results.countryCode?.success ? (results.countryCode.value ?? null) : null,
      ownedLocations,
      locationBuildings,
    },
    tasks,
  });
};
