import {
  CostFunction,
  EdgeInfo,
  GraphStats,
  Neighbor,
  PathfindingResult,
} from "./types/pathfinding";

export class CompactGraph {
  private adjacency: Record<number, Neighbor[]>;
  private nodeToId: Record<string, number>;
  private idToNode: Record<number, string>;
  private nextId: number;

  constructor() {
    this.adjacency = {};
    this.nodeToId = {};
    this.idToNode = {};
    this.nextId = 0;
  }

  private _getNodeId(node: string): number {
    if (!(node in this.nodeToId)) {
      this.nodeToId[node] = this.nextId;
      this.idToNode[this.nextId] = node;
      this.nextId++;
    }
    return this.nodeToId[node]!;
  }

  private _getNodeString(id: number): string {
    return this.idToNode[id]!;
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

    if (!(from in this.adjacency)) {
      this.adjacency[from] = [];
    }

    this.adjacency[from].push({
      neighbor: to,
      isRiver,
      isLand,
      isSea,
      isPort,
      isLake,
    });
  }

  getEdge(a: string, b: string): EdgeInfo {
    const aId = this.nodeToId[a];
    const bId = this.nodeToId[b];

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
    const neighbors = this.adjacency[from];

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

  reachableWithinCost(
    startNode: string,
    costLimit: number,
    getCost: CostFunction,
  ): PathfindingResult {
    const startId = this.nodeToId[startNode];
    if (startId === undefined) return {};

    const distances: PathfindingResult = {};
    const pq: Array<{ node: number; cost: number }> = [
      { node: startId, cost: 0 },
    ];
    distances[startId] = { cost: 0, through: "unknown" };
    while (pq.length > 0) {
      pq.sort((a, b) => a.cost - b.cost);
      const current = pq.shift()!;
      const { node, cost } = current;

      if (cost > costLimit) continue;
      if (cost > distances[node].cost) continue;

      const nodeStr = this._getNodeString(node);

      // Get neighbors as IDs for efficiency
      const neighbors: Neighbor[] = [];
      if (node in this.adjacency) {
        neighbors.push(...this.adjacency[node]!);
      }
      for (const fromStr in this.adjacency) {
        const from = Number(fromStr);
        if (from === node) continue; // Skip self
        const edges = this.adjacency[from];
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
        const newCost = cost + edgeCost.cost;

        if (
          newCost <= costLimit &&
          (!(neighbor in distances) || newCost < distances[neighbor].cost)
        ) {
          distances[neighbor] = { cost: newCost, through: edgeCost.through };
          pq.push({ node: neighbor, cost: newCost });
        }
      }
    }

    // Convert back to string keys
    const result: PathfindingResult = {};
    for (const idStr in distances) {
      const id = Number(idStr);
      result[this._getNodeString(id)] = distances[id];
    }
    return result;
  }

  /**
   * Returns a map of all nodes reachable from startNode within a given number of edges (no cycles),
   * with the minimum cost to each node. Similar to reachableWithinCost, but uses edge count as the limit.
   */
  reachableWithinEdges(
    startNode: string,
    edgeLimit: number,
    getCost: CostFunction,
  ): PathfindingResult {
    const startId = this.nodeToId[startNode];
    if (startId === undefined) return {};

    // Record of nodeId to minimum cost found so far
    const minCost: PathfindingResult = {};
    // Each entry: { node, cost, edgesUsed, visitedSet }
    const queue: Array<{
      node: number;
      cost: number;
      edgesUsed: number;
      visited: Set<number>;
    }> = [
      { node: startId, cost: 0, edgesUsed: 0, visited: new Set([startId]) },
    ];
    minCost[startId] = { cost: 0, through: "unknown" };

    while (queue.length > 0) {
      const current = queue.shift()!;
      const { node, cost, edgesUsed, visited } = current;
      if (edgesUsed >= edgeLimit) continue;

      // Get neighbors as IDs for efficiency
      const neighbors: Neighbor[] = [];
      if (node in this.adjacency) {
        neighbors.push(...this.adjacency[node]!);
      }
      for (const [from, edges] of Object.entries(this.adjacency)) {
        const fromNum = Number(from);
        if (fromNum === node) continue;
        for (const edge of edges) {
          if (edge.neighbor === node) {
            neighbors.push({
              neighbor: fromNum,
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
        if (visited.has(neighbor)) continue; // Prevent cycles
        const neighborStr = this._getNodeString(neighbor);
        const edgeCost = getCost(
          this._getNodeString(node),
          neighborStr,
          isRiver,
          isLand,
          isSea,
          isPort,
          isLake,
        );
        const newCost = cost + edgeCost.cost;
        // Only add if this is the first time or a cheaper path
        if (!(neighbor in minCost) || newCost < minCost[neighbor]!.cost) {
          minCost[neighbor] = { cost: newCost, through: edgeCost.through };
          const newVisited = new Set(visited);
          newVisited.add(neighbor);
          queue.push({
            node: neighbor,
            cost: newCost,
            edgesUsed: edgesUsed + 1,
            visited: newVisited,
          });
        }
      }
    }

    // Convert back to string keys
    const result: PathfindingResult = {};
    for (const idStr in minCost) {
      const id = Number(idStr);
      result[this._getNodeString(id)] = {
        cost: minCost[id].cost,
        through: minCost[id].through,
      };
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

    for (const key in this.adjacency) {
      const neighbors = this.adjacency[key];
      totalEdges += neighbors.length;
      riverEdges += neighbors.filter((n) => n.isRiver).length;
      landEdges += neighbors.filter((n) => n.isLand).length;
      seaEdges += neighbors.filter((n) => n.isSea).length;
      portEdges += neighbors.filter((n) => n.isPort).length;
      lakeEdges += neighbors.filter((n) => n.isLake).length;
    }

    return {
      nodes: Object.keys(this.adjacency).length,
      edges: totalEdges,
      riverEdges,
      landEdges,
      seaEdges,
      portEdges,
      lakeEdges,
    };
  }
}
