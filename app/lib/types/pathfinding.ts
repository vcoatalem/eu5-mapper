import { ILocationIdentifier } from "./general";

// TODO: might need to make edges directional.
// rivers seem to NOT bi directional (e.g pest -> buda is river, buda -> pest is land)

// TODO: it seems like through-sea edges actually apply land costs ?

export interface EdgeInfo {
  exists: boolean;
  type: EdgeType;
}

export interface Neighbor {
  neighbor: number;
  edgeType: EdgeType;
  throughSeaLocation?: string;
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
  throughSeaEdges: number; // TODO: through sea edges are unidirectional. i.e taking them in other direction counts as a "land" proximity
  coastalEdges: number;
  unknownEdges: number;
}

export type EdgeType =
  | "river"
  | "land"
  | "sea"
  | "port"
  | "lake"
  | "port-river" // river-mouth port
  | "through-sea" // special hard-coded ajacency. Allows going from location A -> B while applying sea travel cost of location C
  | "coastal" // land <-> sea adjacency that is not a port (e.g. dover <-> thames)
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
  throughSeaLocation?: string,
) => {
  cost: number;
  through: EdgeType;
  throughSeaLocation?: string;
};

export type PathFindingOptions = {
  allowUnownedLocations?: boolean;
  logForLocations?: ILocationIdentifier[];
  logMethod?: (message: string, data: Record<string, unknown>) => void;
};
