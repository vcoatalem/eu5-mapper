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
