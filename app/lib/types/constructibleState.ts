import {
  BuildingIdentifier,
  IBuildingInstance,
} from "@/app/lib/types/building";
import { ConstructibleAction } from "@/app/lib/types/constructibleAction";

export type ConstructibleState = Record<
  BuildingIdentifier,
  {
    instance?: IBuildingInstance;
    possibleActions: ConstructibleAction[];
  }
>;
