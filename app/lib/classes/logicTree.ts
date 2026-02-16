import {
  IPlacementRestrictionConfig,
  PlacementRestrictionCondition,
  PlacementRestrictions,
} from "@/app/lib/types/building";
import { IGameState, ILocationGameData } from "@/app/lib/types/general";

type EvaluationMethod = (...args: any[]) => boolean;

type LogicLeaf = { type: "leaf"; getValue: EvaluationMethod };
type LogicOperator = {
  type: "operator";
  op: "AND" | "OR";
  children: LogicTree[];
};
export type LogicTree = LogicLeaf | LogicOperator;

export function evaluateLogicTree(tree: LogicTree): boolean {
  if (tree.type === "leaf") {
    // Evaluate leaf (custom logic)
    return tree.getValue();
  } else if (tree.type === "operator") {
    if (tree.op === "AND") {
      return tree.children.every(evaluateLogicTree);
    } else {
      return tree.children.some(evaluateLogicTree);
    }
  }
  return false;
}

export class LogicTreeBuilder {
  public static treeFromConditions(
    conditions: IPlacementRestrictionConfig,
    location: ILocationGameData,
    gameState: IGameState,
    evaluateFn: (
      condition: PlacementRestrictions,
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
          getValue: () => evaluateFn(condition, location, gameState),
        });
      } else {
        root.children.push(
          this.treeFromConditions(condition, location, gameState, evaluateFn),
        );
      }
    }
    return root;
  }
}
