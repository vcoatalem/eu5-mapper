import { BuildingIdentifier } from "@/app/lib/types/building";
import { IBuildingInstance } from "@/app/lib/types/buildingInstance";
import { ConstructibleAction } from "@/app/lib/types/constructibleAction";

export type ConstructibleState = Record<
  BuildingIdentifier,
  {
    instance?: IBuildingInstance;
    possibleActions: ConstructibleAction[];
  }
>;
