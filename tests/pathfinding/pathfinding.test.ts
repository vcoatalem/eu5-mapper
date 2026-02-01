import fs from "fs/promises";
import { readAdjacencyFile, readReferenceFile } from "./utils";
import { IGameData, ILocationIdentifier } from "@/app/lib/types/general";
import { GameStateController } from "@/app/lib/gameState.controller";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";

test("should run", async () => {
  const testData = await readReferenceFile(
    "tests/pathfinding/references/0.0.11/reference_gamestart_proximity_england_0_0_11.csv",
  );

  const gameDataFolder = "public/0.0.11/game_data";

  const adjGraph = await readAdjacencyFile(
    `${gameDataFolder}/adjacency-data.csv`,
  );

  // TODO: factorize loading with app/lib/appContextProvider.ts
  const files = [
    `${gameDataFolder}/location-data-map.json`,
    `${gameDataFolder}/proximity-calculation-rules.json`,
    `${gameDataFolder}/roads.json`,
    `${gameDataFolder}/countries-data-map.json`,
    `${gameDataFolder}/buildings-template-map.json`,
  ];

  const locationDataMap = await JSON.parse(
    await fs.readFile(files[0], "utf-8"),
  );
  const proximityComputationRule = await JSON.parse(
    await fs.readFile(files[1], "utf-8"),
  );
  const roads = await JSON.parse(await fs.readFile(files[2], "utf-8"));
  const countriesDataMap = await JSON.parse(
    await fs.readFile(files[3], "utf-8"),
  );

  const buildingsTemplateMap = await JSON.parse(
    await fs.readFile(files[4], "utf-8"),
  );

  const gameData: IGameData = {
    locationDataMap: locationDataMap,
    proximityComputationRule: proximityComputationRule,
    roads: roads,
    countriesDataMap: countriesDataMap,
    colorToNameMap: {},
    buildingsTemplateMap: buildingsTemplateMap,
  };

  const gameStateController = new GameStateController();
  gameStateController.init(gameData);
  gameStateController.reset("ENG");
  gameStateController.changeCountryValues({
    rulerAdministrativeAbility: 80,
  });

  const gameState = gameStateController.getSnapshot();

  const costFunction = ProximityComputationHelper.getProximityCostFunction(
    gameState,
    gameData,
    {
      allowUnownedLocations: true,
    },
  );

  const reachable = adjGraph.reachableWithinCost(
    gameState.capitalLocation!,
    100,
    costFunction,
  );

  // Assert

  const differences: Record<
    ILocationIdentifier,
    { expected: number; actual: number }
  > = {};

  for (const [location, data] of Object.entries(testData)) {
    differences[location] = {
      expected: data,
      actual: ProximityComputationHelper.evaluationToProximity(
        reachable[location]?.cost,
      ),
    };
  }

  const results: Record<ILocationIdentifier, number> = {};
  for (const [location, { expected, actual }] of Object.entries(differences)) {
    const difference = Math.abs(expected - actual);
    results[location] = difference;
  }

  const toleratedDifference = 2;
  const goodResults = Object.entries(results)
    .filter(([_, diff]) => diff <= toleratedDifference)
    .map(([loc, _]) => results[loc]);

  console.log(
    "Good results:",
    goodResults.length,
    "/",
    Object.keys(testData).length,
  );

  const badResults = Object.entries(differences)
    .filter(
      ([_, { expected, actual }]) =>
        Math.abs(expected - actual) > toleratedDifference,
    )
    .map(([loc, { expected, actual }]) => ({
      locationName: loc,
      actual,
      expected,
    }));

  if (badResults.length > 0)
    throw new Error(
      "The following locations have bad proximity results:\n" +
        badResults
          .map(
            ({ locationName, actual, expected }) =>
              `${locationName}: actual=${actual}, expected=${expected}`,
          )
          .join("\n"),
    );
});
