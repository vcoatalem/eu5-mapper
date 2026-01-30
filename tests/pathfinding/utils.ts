import { CompactGraph } from "@/app/lib/graph";
import { ParserHelper } from "@/app/lib/parser.helper";
import fs from "fs";

export const readReferenceFile = async (
  path: string,
): Promise<[string, number][]> => {
  const f = await fs.readFileSync(path, "utf-8");
  return f
    .split("\n")
    .splice(0, 1)
    .map((line) => line.trim().split(",") as [string, string])
    .map(([location, proximity]) => [location, parseFloat(proximity)]);
};

export const readAdjacencyFile = async (
  path: string,
): Promise<CompactGraph> => {
  const adjacencyData = await fs.readFileSync(path, "utf-8");
  return ParserHelper.parseAdjacencyCSV(adjacencyData);
};
