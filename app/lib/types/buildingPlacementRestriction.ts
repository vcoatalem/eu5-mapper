import { z } from "zod";

const ZodBuildingPlacementRestrictions = z.enum([
  "is_coastal",
  "has_river",
  "is_adjacent_to_lake",
  "has_road",
  "is_capital",
  "is_not_capital",
]);

export const ZodBuildingPlacementRestrictionConfig: z.ZodType<BuildingPlacementRestrictionConfig> =
  z.object({
    op: z.enum(["AND", "OR"]),
    conditions: z.array(
      z.union([
        ZodBuildingPlacementRestrictions,
        z.lazy(
          (): z.ZodType<BuildingPlacementRestrictionConfig> =>
            ZodBuildingPlacementRestrictionConfig,
        ),
      ]),
    ),
  });

export type BuildingPlacementRestrictions = z.infer<
  typeof ZodBuildingPlacementRestrictions
>;

export type BuildingPlacementRestrictionCondition =
  | BuildingPlacementRestrictions
  | BuildingPlacementRestrictionConfig;

export interface BuildingPlacementRestrictionConfig {
  op: "AND" | "OR";
  conditions: BuildingPlacementRestrictionCondition[];
}
