export interface EdgeInfo {
  exists: boolean;
  isRiver: boolean;
  isLand: boolean;
  isSea: boolean;
  isPort: boolean;
  isLake: boolean;
}

export interface Neighbor {
  neighbor: number;
  isRiver: boolean;
  isLand: boolean;
  isSea: boolean;
  isPort: boolean;
  isLake: boolean;
}

export interface NeighborInfo {
  name: string;
  isRiver: boolean;
  isLand: boolean;
  isSea: boolean;
  isPort: boolean;
  isLake: boolean;
}

export interface GraphStats {
  nodes: number;
  edges: number;
  riverEdges: number;
  landEdges: number;
  seaEdges: number;
  portEdges: number;
  lakeEdges: number;
}

export type CostFunction = (
  from: string,
  to: string,
  isRiver: boolean,
  isLand: boolean,
  isSea: boolean,
  isPort: boolean,
  isLake: boolean,
) => number;
