import { readAdjacencyFile, readReferenceFile } from "./utils";

test("should run", async () => {
  const testData = await readReferenceFile(
    "tests/pathfinding/references/0.0.11/reference_gamestart_proximity_england_0_0_11.csv",
  );

  const adjGraph = readAdjacencyFile(
    "tests/pathfinding/references/0.0.11/adjacency-data.csv",
  );

  expect(1 + 1).toBe(2);
});
