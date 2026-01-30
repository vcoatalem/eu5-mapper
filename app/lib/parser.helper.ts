import { CompactGraph } from "./graph";

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

      const [locationA, locationB, accessType] = line.split(",");

      // Add edge with appropriate flags based on access type
      const isRiver = accessType === "river";
      const isLand = accessType === "land";
      const isSea = accessType === "sea";
      const isPort = accessType === "port";
      const isLake = accessType === "lake";

      graph.addEdge(
        locationA,
        locationB,
        isRiver,
        isLand,
        isSea,
        isPort,
        isLake,
      );
    }

    return graph;
  }
}
