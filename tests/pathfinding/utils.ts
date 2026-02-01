import { CompactGraph } from "@/app/lib/graph";
import { ParserHelper } from "@/app/lib/parser.helper";
import { ILocationIdentifier } from "@/app/lib/types/general";
import fs from "fs";

export const readReferenceFile = async (
  path: string,
): Promise<Record<ILocationIdentifier, number>> => {
  const f = await fs.readFileSync(path, "utf-8");
  return f
    .split("\n")
    .slice(1) // skip header
    .filter((line) => line.trim().length > 0) // ignore empty lines
    .map((line) => line.trim().split(",") as [string, string])
    .reduce(
      (acc, [location, proximity]) => {
        acc[location] = Number(proximity);
        return acc;
      },
      {} as Record<ILocationIdentifier, number>,
    );
};

export const readAdjacencyFile = async (
  path: string,
): Promise<CompactGraph> => {
  const adjacencyData = await fs.readFileSync(path, "utf-8");
  return ParserHelper.parseAdjacencyCSV(adjacencyData);
};
