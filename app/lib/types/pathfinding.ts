export interface EdgeInfo {
  exists: boolean;
  isRiver: boolean;
  isLand: boolean;
  isSea: boolean;
  isPort: boolean;
}

export interface Neighbor {
  neighbor: number;
  isRiver: boolean;
  isLand: boolean;
  isSea: boolean;
  isPort: boolean;
}

export interface NeighborInfo {
  name: string;
  isRiver: boolean;
  isLand: boolean;
  isSea: boolean;
  isPort: boolean;
}

export interface GraphStats {
  nodes: number;
  edges: number;
  riverEdges: number;
  landEdges: number;
  seaEdges: number;
  portEdges: number;
}

export type CostFunctionString = (
  from: string,
  to: string,
  isRiver: boolean,
  isLand: boolean,
  isSea: boolean,
  isPort: boolean,
) => number;
