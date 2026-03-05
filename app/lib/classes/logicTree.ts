import {
  BuildingPlacementRestrictionConfig,
  BuildingPlacementRestrictions,
} from "@/app/lib/types/buildingPlacementRestriction";
import { IGameState } from "@/app/lib/types/gameState";
import { ILocationIdentifier } from "@/app/lib/types/general";
import { ILocationGameData } from "@/app/lib/types/location";

type EvaluationMethod = (
  gameState: IGameState,
  location: ILocationIdentifier,
) => boolean;

type LogicLeaf = { type: "leaf"; getValue: EvaluationMethod };
type LogicOperator = {
  type: "operator";
  op: "AND" | "OR";
  children: LogicTree[];
};
export type LogicTree = LogicLeaf | LogicOperator;

export function evaluateLogicTree(
  tree: LogicTree,
  location: ILocationIdentifier,
  gameState: IGameState,
): boolean {
  if (tree.type === "leaf") {
    // Evaluate leaf (custom logic)
    return tree.getValue(gameState, location);
  } else if (tree.type === "operator") {
    if (tree.op === "AND") {
      return tree.children.every((child) =>
        evaluateLogicTree(child, location, gameState),
      );
    } else {
      return tree.children.some((child) =>
        evaluateLogicTree(child, location, gameState),
      );
    }
  }
  return false;
}

export class LogicTreeBuilder {
  public static treeFromConditions(
    conditions: BuildingPlacementRestrictionConfig,
    getLocationData: (
      locationId: ILocationIdentifier,
    ) => ILocationGameData | undefined,
    evaluateFn: (
      condition: BuildingPlacementRestrictions,
      location: ILocationGameData,
      gameState: IGameState,
    ) => boolean,
  ): LogicTree {
    const root: LogicTree = {
      type: "operator",
      op: conditions.op,
      children: [],
    };
    for (const condition of conditions.conditions) {
      if (typeof condition === "string") {
        root.children.push({
          type: "leaf",
          getValue: (gameState, locationId) => {
            const location = getLocationData(locationId);
            if (!location) return false;
            return evaluateFn(condition, location, gameState);
          },
        });
      } else {
        root.children.push(
          this.treeFromConditions(condition, getLocationData, evaluateFn),
        );
      }
    }
    return root;
  }
}
