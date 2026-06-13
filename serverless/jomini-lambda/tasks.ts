import {
  SaveParsingTaskLabel,
  type SaveParsingTaskName,
} from "@shared/saveData";
import type { ParsedRoot } from "./jomini";
import { TaskSchemas } from "./validators";
import type { AllTaskResults, LooseTaskResults, TaskDefinition } from "./types";

function defineTask<
  T extends SaveParsingTaskName,
  const TDep extends readonly SaveParsingTaskName[] = readonly [],
>(
  name: T,
  config: Omit<TaskDefinition<T, TDep>, "schema">,
): TaskDefinition<T, TDep> {
  return { ...config, schema: TaskSchemas[name] };
}

const TaskRegistry = {
  locationsIndexList: defineTask("locationsIndexList", {
    label: SaveParsingTaskLabel.locationsIndexList,
    run: async ({ parsedRoot }) => parsedRoot.locationsIndexList,
  }),
  version: defineTask("version", {
    label: SaveParsingTaskLabel.version,
    run: async ({ parsedRoot }) => parsedRoot.version,
  }),
  countryCode: defineTask("countryCode", {
    label: SaveParsingTaskLabel.countryCode,
    run: async ({ parsedRoot }) => parsedRoot.flag,
  }),
  countryTags: defineTask("countryTags", {
    label: SaveParsingTaskLabel.countryTags,
    run: async ({ parsedRoot }) => parsedRoot.countryTagsList,
  }),
  countryCodeIndex: defineTask("countryCodeIndex", {
    label: SaveParsingTaskLabel.countryCodeIndex,
    dependsOn: ["countryTags", "countryCode"] as const,
    run: async ({ results }) => {
      const tags = results.countryTags.value;
      const code = results.countryCode.value;
      if (!tags || !code) return null;
      return (
        tags.find(
          (e: { index: number; countryCode: string }) => e.countryCode === code,
        )?.index ?? null
      );
    },
  }),
  countryData: defineTask("countryData", {
    label: SaveParsingTaskLabel.countryData,
    run: async ({ parsedRoot }) => ({
      countryOwnedLocations: parsedRoot.countryOwnedLocations ?? [],
    }),
  }),
  ownedLocations: defineTask("ownedLocations", {
    label: SaveParsingTaskLabel.ownedLocations,
    dependsOn: ["countryData", "locationsIndexList"] as const,
    run: async ({ results }) =>
      results.countryData.value?.countryOwnedLocations ?? [],
  }),
  buildingsRaw: defineTask("buildingsRaw", {
    label: SaveParsingTaskLabel.buildingsRaw,
    run: async ({ parsedRoot }) => parsedRoot.buildings ?? null,
  }),
  buildings: defineTask("buildings", {
    label: SaveParsingTaskLabel.buildings,
    dependsOn: ["buildingsRaw", "ownedLocations"] as const,
    run: async ({ results }) => results.buildingsRaw.value ?? [],
  }),
} as const;

export const taskExecutionOrder: SaveParsingTaskName[] = [
  "locationsIndexList",
  "version",
  "countryCode",
  "countryTags",
  "countryCodeIndex",
  "countryData",
  "ownedLocations",
  "buildingsRaw",
  "buildings",
];

export const executeTasks = async (
  fileContent: Uint8Array,
  parsedRoot: ParsedRoot,
): Promise<AllTaskResults> => {
  const results = {} as LooseTaskResults;

  for (const taskName of taskExecutionOrder) {
    const task = TaskRegistry[taskName];
    const deps = task.dependsOn ?? [];
    const depFailed = deps.some((d) => results[d] && !results[d].success);

    if (depFailed) {
      results[taskName] = { success: false, skipped: true };
      continue;
    }

    try {
      const depsResults = Object.fromEntries(
        deps.map((d) => [d, results[d] ?? null]),
      ) as Required<Pick<AllTaskResults, (typeof deps)[number]>>;

      const raw = await task.run({
        fileContent,
        parsedRoot,
        results: depsResults,
      });

      const res = task.schema.safeParse(raw);
      if (!res.success) {
        console.warn(`[jomini] (${taskName}) validation failed`, res.error);
        results[taskName] = { success: false, errors: res.error };
      } else {
        results[taskName] = { success: true, value: res.data };
      }
    } catch (err) {
      console.error(`[jomini] (${taskName}) error:`, err);
      results[taskName] = { success: false, errors: err };
    }
  }

  return results as AllTaskResults;
};
