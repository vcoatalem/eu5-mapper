import { BuildingTemplate } from "@/app/lib/types/buildingTemplate";

export interface IBuildingInstance {
  template: BuildingTemplate;
  level: number;
}

export type BuildingIdentifier = BuildingTemplate["name"];
