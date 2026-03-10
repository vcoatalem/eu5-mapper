import { ZodBuildingTemplate } from "@/app/lib/types/buildingTemplate";
import { z } from "zod";

export const ZodBuildingInstance = z.object({
  template: ZodBuildingTemplate,
  level: z.number(),
});

export type IBuildingInstance = z.infer<typeof ZodBuildingInstance>;
