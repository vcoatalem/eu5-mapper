import { ILocationIdentifier } from "./general";

export interface EdgeInfo {
  exists: boolean;
  type: EdgeType;
}

export interface Neighbor {
  neighbor: number;
  edgeType: EdgeType;
}

export interface NeighborInfo {
  name: string;
  edgeType: EdgeType;
}

export interface GraphStats {
  nodes: number;
  edges: number;
  riverEdges: number;
  landEdges: number;
  seaEdges: number;
  portEdges: number;
  lakeEdges: number;
  portRiverEdges: number;
}

export type EdgeType =
  | "river"
  | "land"
  | "sea"
  | "port"
  | "lake"
  | "port-river"
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
  edgeType: EdgeType,
) => {
  cost: number;
  through: EdgeType;
};

export type PathFindingOptions = {
  allowUnownedLocations?: boolean;
  logForLocations?: ILocationIdentifier[];
  logMethod?: (message: string, data: Record<string, unknown>) => void;
};
