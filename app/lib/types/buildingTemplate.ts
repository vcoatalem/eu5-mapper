import { ZodBuildingPlacementRestrictionConfig } from "@/app/lib/types/buildingPlacementRestriction";
import { ZodBuildingType } from "@/app/lib/types/buildingType";
import { z } from "zod";

export const ZodBuildingTemplate = z.object({
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
  placementRestriction:
    ZodBuildingPlacementRestrictionConfig.nullable().optional(),
  buildable: z.boolean(), // whether the building can be built by the player in normal circumstances (false for most "special" buildings)
});

export const ZodBuildingTemplateArray = z.array(ZodBuildingTemplate);

export type BuildingTemplate = z.infer<typeof ZodBuildingTemplate>;
