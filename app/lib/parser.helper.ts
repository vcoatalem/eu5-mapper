import { CompactGraph } from "./graph";
import { RoadRecord } from "./types/general";
import { EdgeType } from "./types/pathfinding";

export class ParserHelper {
  /**
   * Parses adjacency CSV data and builds a CompactGraph
   * @param csvContent The raw CSV content as a string
   * @returns A populated CompactGraph instance
   */
  static parseAdjacencyCSV(csvContent: string): CompactGraph {
    const graph = new CompactGraph();
    const lines = csvContent.trim().split("\n");

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [locationA, locationB, edgeType, throughSeaLocation] =
        line.split(",");
      if (
        [
          "river",
          "land",
          "sea",
          "port",
          "lake",
          "port-river",
          "through-sea",
        ].includes(edgeType) === false
      ) {
        throw new Error(
          `Invalid edge type "${edgeType}" in adjacency CSV at line ${i + 1}`,
        );
      }

      graph.addEdge(
        locationA,
        locationB,
        edgeType as EdgeType,
        throughSeaLocation || undefined,
      );
    }

    return graph;
  }

  // jsonContent should be an array of [from, to] pairs
  static parseRoadFile(jsonContent: any): RoadRecord {
    const roadRecord: RoadRecord = {};

    for (const roadEntry of jsonContent) {
      const [from, to] = roadEntry;
      if (roadRecord[from] === undefined) {
        roadRecord[from] = [];
      }
      if (roadRecord[to] === undefined) {
        // doubling the size of the road record allows us to have O(1) lookups for both directions
        roadRecord[to] = [];
      }
      roadRecord[from].push({
        to: to,
        type: "gravel_road",
        createdByUser: false,
      });
      roadRecord[to].push({
        to: from,
        type: "gravel_road",
        createdByUser: false,
      });
    }
    return roadRecord;
  }
}
