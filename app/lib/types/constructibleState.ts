import { BuildingIdentifier } from "@/app/lib/types/building";
import { BuildingInstance } from "@/app/lib/types/buildingInstance";
import { ConstructibleAction } from "@/app/lib/types/constructibleAction";

export type ConstructibleState = Record<
  BuildingIdentifier,
  {
    instance?: BuildingInstance;
    possibleActions: ConstructibleAction[];
  }
>;
