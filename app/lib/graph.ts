import {
  CostFunction,
  EdgeInfo,
  EdgeType,
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

  addEdge(
    a: string,
    b: string,
    edgeType: EdgeType,
    throughSeaLocation?: string,
  ): void {
    const aId = this._getNodeId(a);
    const bId = this._getNodeId(b);

    if (!(aId in this.adjacency)) {
      this.adjacency[aId] = [];
    }
    if (!(bId in this.adjacency)) {
      this.adjacency[bId] = [];
    }

    const edgeAB: Neighbor = {
      neighbor: bId,
      edgeType,
    };
    const edgeBA: Neighbor = {
      neighbor: aId,
      edgeType,
    };

    if (throughSeaLocation !== undefined) {
      edgeAB.throughSeaLocation = throughSeaLocation;
      edgeBA.throughSeaLocation = throughSeaLocation;
    }

    this.adjacency[aId].push(edgeAB);
    this.adjacency[bId].push(edgeBA);
  }

  getEdge(a: string, b: string): EdgeInfo {
    const aId = this.nodeToId[a];
    const bId = this.nodeToId[b];

    if (aId === undefined || bId === undefined) {
      return {
        exists: false,
        type: "unknown",
      };
    }

    // With bidirectional storage, check either direction
    const neighbors = this.adjacency[aId];
    if (!neighbors) {
      return {
        exists: false,
        type: "unknown",
      };
    }

    const edge = neighbors.find((n) => n.neighbor === bId);
    return edge
      ? {
          exists: true,
          type: edge.edgeType,
        }
      : {
          exists: false,
          type: "unknown",
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
      // Edges are stored bidirectionally, so we just need to look in adjacency[node]
      const edges = this.adjacency[node] ?? [];

      for (const { neighbor, edgeType, throughSeaLocation } of edges) {
        const neighborStr = this._getNodeString(neighbor);
        const edgeCost = getCost(
          nodeStr,
          neighborStr,
          edgeType,
          throughSeaLocation,
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
   * Finds the shortest path from startNode to endNode and returns the path as an array of edges.
   * Each edge contains { from, to, edgeType, cost }.
   * Returns null if no path exists within the cost limit.
   */
  getShortestPath(
    startNode: string,
    endNode: string,
    costLimit: number,
    getCost: CostFunction,
  ): Array<{
    from: string;
    to: string;
    edgeType: EdgeType;
    cost: number;
  }> | null {
    const startId = this.nodeToId[startNode];
    const endId = this.nodeToId[endNode];

    if (startId === undefined || endId === undefined) return null;
    if (startId === endId) return []; // Same node, empty path

    // Track distances and predecessors
    const distances: Record<number, number> = {};
    const predecessors: Record<
      number,
      { node: number; edgeType: EdgeType } | null
    > = {};
    const pq: Array<{ node: number; cost: number }> = [
      { node: startId, cost: 0 },
    ];

    distances[startId] = 0;
    predecessors[startId] = null;

    while (pq.length > 0) {
      pq.sort((a, b) => a.cost - b.cost);
      const current = pq.shift()!;
      const { node, cost } = current;

      // If we reached the destination, reconstruct and return the path
      if (node === endId) {
        const path: Array<{
          from: string;
          to: string;
          edgeType: EdgeType;
          cost: number;
        }> = [];
        let currentNode = endId;

        while (predecessors[currentNode] !== null) {
          const pred = predecessors[currentNode]!;
          const fromStr = this._getNodeString(pred.node);
          const toStr = this._getNodeString(currentNode);
          const edgeCost = getCost(fromStr, toStr, pred.edgeType);

          path.unshift({
            from: fromStr,
            to: toStr,
            edgeType: pred.edgeType,
            cost: edgeCost.cost,
          });

          currentNode = pred.node;
        }

        return path;
      }

      if (cost > costLimit) continue;
      if (cost > distances[node]) continue;

      const nodeStr = this._getNodeString(node);

      // Get neighbors
      const edges = this.adjacency[node] ?? [];

      for (const { neighbor, edgeType, throughSeaLocation } of edges) {
        const neighborStr = this._getNodeString(neighbor);
        const edgeCost = getCost(
          nodeStr,
          neighborStr,
          edgeType,
          throughSeaLocation,
        );
        const newCost = cost + edgeCost.cost;

        if (
          newCost <= costLimit &&
          (!(neighbor in distances) || newCost < distances[neighbor])
        ) {
          distances[neighbor] = newCost;
          predecessors[neighbor] = { node, edgeType };
          pq.push({ node: neighbor, cost: newCost });
        }
      }
    }

    return null;
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
      // Edges are stored bidirectionally, so we just need to look in adjacency[node]
      const edges = this.adjacency[node] ?? [];

      for (const { neighbor, edgeType, throughSeaLocation } of edges) {
        if (visited.has(neighbor)) continue; // Prevent cycles
        const neighborStr = this._getNodeString(neighbor);
        const nodeStr = this._getNodeString(node);
        const edgeCost = getCost(
          nodeStr,
          neighborStr,
          edgeType,
          throughSeaLocation,
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
    let portRiverEdges = 0;
    let throughSeaEdges = 0;

    for (const key in this.adjacency) {
      const neighbors = this.adjacency[key];
      totalEdges += neighbors.length;
      riverEdges += neighbors.filter((n) => n.edgeType === "river").length;
      landEdges += neighbors.filter((n) => n.edgeType === "land").length;
      seaEdges += neighbors.filter((n) => n.edgeType === "sea").length;
      portEdges += neighbors.filter((n) => n.edgeType === "port").length;
      lakeEdges += neighbors.filter((n) => n.edgeType === "lake").length;
      portRiverEdges += neighbors.filter(
        (n) => n.edgeType === "port-river",
      ).length;
      throughSeaEdges += neighbors.filter(
        (n) => n.edgeType === "through-sea",
      ).length;
    }

    return {
      nodes: Object.keys(this.adjacency).length,
      edges: totalEdges,
      riverEdges,
      landEdges,
      seaEdges,
      portEdges,
      lakeEdges,
      portRiverEdges,
    };
  }
}
