import { ILocationIdentifier } from "./general";

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

type EdgeType =
  | "river"
  | "land"
  | "sea"
  | "port"
  | "lake"
  | "unowned_location"
  | "unknown";

export type PathfindingResult = Record<
  ILocationIdentifier,
  {
    cost: number;
    through: EdgeType;
  }
>;

export type CostFunction = (
  from: string,
  to: string,
  isRiver: boolean,
  isLand: boolean,
  isSea: boolean,
  isPort: boolean,
  isLake: boolean,
) => {
  cost: number;
  through: EdgeType;
};
