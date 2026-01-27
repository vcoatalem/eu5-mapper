import {
  CostFunction,
  EdgeInfo,
  GraphStats,
  Neighbor,
  NeighborInfo,
} from "./types/pathfinding";

export class CompactGraph {
  private adjacency: Map<number, Neighbor[]>;
  private nodeToId: Map<string, number>;
  private idToNode: Map<number, string>;
  private nextId: number;

  constructor() {
    this.adjacency = new Map<number, Neighbor[]>();
    this.nodeToId = new Map<string, number>();
    this.idToNode = new Map<number, string>();
    this.nextId = 0;
  }

  private _getNodeId(node: string): number {
    if (!this.nodeToId.has(node)) {
      this.nodeToId.set(node, this.nextId);
      this.idToNode.set(this.nextId, node);
      this.nextId++;
    }
    return this.nodeToId.get(node)!;
  }

  private _getNodeString(id: number): string {
    return this.idToNode.get(id)!;
  }

  private _getCanonical(a: number, b: number): [number, number] {
    return a < b ? [a, b] : [b, a];
  }

  addEdge(
    a: string,
    b: string,
    isRiver: boolean = false,
    isLand: boolean = false,
    isSea: boolean = false,
    isPort: boolean = false,
    isLake: boolean = false,
  ): void {
    const aId = this._getNodeId(a);
    const bId = this._getNodeId(b);
    const [from, to] = this._getCanonical(aId, bId);

    if (!this.adjacency.has(from)) {
      this.adjacency.set(from, []);
    }

    this.adjacency.get(from)!.push({
      neighbor: to,
      isRiver,
      isLand,
      isSea,
      isPort,
      isLake,
    });
  }

  getEdge(a: string, b: string): EdgeInfo {
    const aId = this.nodeToId.get(a);
    const bId = this.nodeToId.get(b);

    if (aId === undefined || bId === undefined) {
      return {
        exists: false,
        isRiver: false,
        isLand: false,
        isSea: false,
        isPort: false,
        isLake: false,
      };
    }

    const [from, to] = this._getCanonical(aId, bId);
    const neighbors = this.adjacency.get(from);

    if (!neighbors) {
      return {
        exists: false,
        isRiver: false,
        isLand: false,
        isSea: false,
        isPort: false,
        isLake: false,
      };
    }

    const edge = neighbors.find((n) => n.neighbor === to);
    return edge
      ? {
          exists: true,
          isRiver: edge.isRiver,
          isLand: edge.isLand,
          isSea: edge.isSea,
          isPort: edge.isPort,
          isLake: edge.isLake,
        }
      : {
          exists: false,
          isRiver: false,
          isLand: false,
          isSea: false,
          isPort: false,
          isLake: false,
        };
  }

  getNeighborNodesNames(node: string): NeighborInfo[] {
    const nodeId = this.nodeToId.get(node);
    if (nodeId === undefined) return [];

    const neighbors: Neighbor[] = [];

    // Check edges where this node is the "from"
    if (this.adjacency.has(nodeId)) {
      neighbors.push(...this.adjacency.get(nodeId)!);
    }

    // Check edges where this node is the "to"
    for (const [from, edges] of this.adjacency.entries()) {
      if (from === nodeId) continue; // Skip self

      for (const edge of edges) {
        if (edge.neighbor === nodeId) {
          neighbors.push({
            neighbor: from,
            isRiver: edge.isRiver,
            isLand: edge.isLand,
            isSea: edge.isSea,
            isPort: edge.isPort,
            isLake: edge.isLake,
          });
        }
      }
    }

    // Convert back to strings
    return neighbors.map((n) => ({
      name: this._getNodeString(n.neighbor),
      isRiver: n.isRiver,
      isLand: n.isLand,
      isSea: n.isSea,
      isPort: n.isPort,
      isLake: n.isLake,
    }));
  }

  reachableWithinCost(
    startNode: string,
    costLimit: number,
    getCost: CostFunction,
  ): Map<string, number> {
    const startId = this.nodeToId.get(startNode);
    if (startId === undefined) return new Map();

    const distances = new Map<number, number>();
    const pq: Array<{ node: number; cost: number }> = [
      { node: startId, cost: 0 },
    ];
    distances.set(startId, 0);

    while (pq.length > 0) {
      pq.sort((a, b) => a.cost - b.cost);
      const current = pq.shift()!;
      const { node, cost } = current;

      if (cost > costLimit) continue;
      if (cost > distances.get(node)!) continue;

      const nodeStr = this._getNodeString(node);

      // Get neighbors as IDs for efficiency
      const neighbors: Neighbor[] = [];
      if (this.adjacency.has(node)) {
        neighbors.push(...this.adjacency.get(node)!);
      }
      for (const [from, edges] of this.adjacency.entries()) {
        if (from === node) continue; // Skip self
        for (const edge of edges) {
          if (edge.neighbor === node) {
            neighbors.push({
              neighbor: from,
              isRiver: edge.isRiver,
              isLand: edge.isLand,
              isSea: edge.isSea,
              isPort: edge.isPort,
              isLake: edge.isLake,
            });
          }
        }
      }

      for (const {
        neighbor,
        isRiver,
        isLand,
        isSea,
        isPort,
        isLake,
      } of neighbors) {
        const neighborStr = this._getNodeString(neighbor);
        const edgeCost = getCost(
          nodeStr,
          neighborStr,
          isRiver,
          isLand,
          isSea,
          isPort,
          isLake,
        );
        const newCost = cost + edgeCost;

        if (
          newCost <= costLimit &&
          (!distances.has(neighbor) || newCost < distances.get(neighbor)!)
        ) {
          distances.set(neighbor, newCost);
          pq.push({ node: neighbor, cost: newCost });
        }
      }
    }

    // Convert back to string keys
    const result = new Map<string, number>();
    for (const [id, dist] of distances.entries()) {
      result.set(this._getNodeString(id), dist);
    }
    return result;
  }

  getStats(): GraphStats {
    let totalEdges = 0;
    let riverEdges = 0;
    let landEdges = 0;
    let seaEdges = 0;
    let portEdges = 0;
    let lakeEdges = 0;

    for (const neighbors of this.adjacency.values()) {
      totalEdges += neighbors.length;
      riverEdges += neighbors.filter((n) => n.isRiver).length;
      landEdges += neighbors.filter((n) => n.isLand).length;
      seaEdges += neighbors.filter((n) => n.isSea).length;
      portEdges += neighbors.filter((n) => n.isPort).length;
      lakeEdges += neighbors.filter((n) => n.isLake).length;
    }

    return {
      nodes: this.adjacency.size,
      edges: totalEdges,
      riverEdges,
      landEdges,
      seaEdges,
      portEdges,
      lakeEdges,
    };
  }
}
