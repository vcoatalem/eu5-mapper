import * as z from "zod";

const ZodBuildingType = z.enum(["rural", "urban", "city", "common"]);

const ZodPlacementRestrictions = z.enum([
  "is_coastal",
  "has_river",
  "is_adjacent_to_lake",
  "has_road",
  "is_capital",
  "is_not_capital",
]);

const ZodPlacementRestrictionConfig: z.ZodType<IPlacementRestrictionConfig> =
  z.object({
    op: z.enum(["AND", "OR"]),
    conditions: z.array(
      z.union([
        ZodPlacementRestrictions,
        z.lazy(
          (): z.ZodType<IPlacementRestrictionConfig> =>
            ZodPlacementRestrictionConfig,
        ),
      ]),
    ),
  });

const ZodBuildingTemplate = z.object({
  name: z.string(),
  type: ZodBuildingType,
  upgrade: z.string().nullable(), // name of potential upgrade path for the building, null if no upgrade available
  downgrade: z.string().nullable(), // name of potential downgrade path for the building, null if no downgrade available
  cap: z.number().nullable(), // how many of this building can be built on a single location, null if no cap
  modifiers: z.object({
    localProximitySource: z.number().nullable().optional(),
    harborSuitability: z.number().nullable().optional(),
    localProximityCostModifier: z.number().nullable().optional(),
    globalProximityCostModifier: z.number().nullable().optional(),
  }),
  placementRestriction: ZodPlacementRestrictionConfig.nullable().optional(),
  buildable: z.boolean(), // whether the building can be built by the player in normal circumstances (false for most "special" buildings)
});

export const ZodBuildingTemplateArray = z.array(ZodBuildingTemplate);

export type INewBuildingTemplate = z.infer<typeof ZodBuildingTemplate>;

export type BuildingType = z.infer<typeof ZodBuildingType>;

export type PlacementRestrictions = z.infer<typeof ZodPlacementRestrictions>;

export type PlacementRestrictionCondition =
  | PlacementRestrictions
  | IPlacementRestrictionConfig;

export interface IPlacementRestrictionConfig {
  op: "AND" | "OR";
  conditions: PlacementRestrictionCondition[];
}

export interface IBuildingInstance {
  template: INewBuildingTemplate;
  level: number;
}

export type ConstructibleAction =
  | {
      type: "upgrade";
      building: INewBuildingTemplate["name"];
      to: INewBuildingTemplate;
    }
  | {
      type: "downgrade";
      building: INewBuildingTemplate["name"];
      to: INewBuildingTemplate;
    }
  | {
      type: "demolish";
      building: INewBuildingTemplate["name"];
    }
  | {
      type: "build";
      building: INewBuildingTemplate["name"];
    };

export type ConstructibleState = Record<
  string,
  {
    instance?: IBuildingInstance;
    possibleActions: ConstructibleAction[];
  }
>;
