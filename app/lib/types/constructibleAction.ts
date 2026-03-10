import { BuildingIdentifier } from "@/app/lib/types/building";
import { BuildingTemplate } from "@/app/lib/types/buildingTemplate";

export type ConstructibleAction =
  | {
      type: "upgrade";
      building: BuildingIdentifier;
      to: BuildingTemplate;
    }
  | {
      type: "downgrade";
      building: BuildingIdentifier;
      to: BuildingTemplate;
    }
  | {
      type: "demolish";
      building: BuildingIdentifier;
    }
  | {
      type: "build";
      building: BuildingIdentifier;
    };
