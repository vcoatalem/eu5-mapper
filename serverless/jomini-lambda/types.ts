import { z } from "zod";
import type { SaveParsingTaskName } from "@shared/saveData";
import type { ParsedRoot } from "./jomini";
import type { TaskSchemas } from "./validators";

export type TaskSchemaMap = typeof TaskSchemas;

export type TaskResult<T extends SaveParsingTaskName> = {
  success: boolean;
  value?: z.infer<TaskSchemaMap[T]>;
  errors?: unknown;
  skipped?: boolean;
};

export type AllTaskResults = { [K in SaveParsingTaskName]?: TaskResult<K> };

export type TaskDefinition<
  T extends SaveParsingTaskName,
  TDep extends readonly SaveParsingTaskName[] = readonly [],
> = {
  label: string;
  dependsOn?: TDep;
  run: (ctx: {
    fileContent: Uint8Array;
    parsedRoot: ParsedRoot;
    results: Required<Pick<AllTaskResults, TDep[number]>>;
  }) => Promise<z.input<TaskSchemaMap[T]>>;
  schema: TaskSchemaMap[T];
};

export type LooseTaskResult = {
  success: boolean;
  value?: unknown;
  errors?: unknown;
  skipped?: boolean;
};

export type LooseTaskResults = Record<
  SaveParsingTaskName,
  LooseTaskResult | undefined
>;
