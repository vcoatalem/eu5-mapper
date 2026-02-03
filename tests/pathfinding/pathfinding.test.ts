import fs from "fs/promises";
import { readAdjacencyFile, readReferenceFile, generateHtmlReport } from "./utils";
import { IGameData, ILocationIdentifier } from "@/app/lib/types/general";
import { GameStateController } from "@/app/lib/gameState.controller";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";
import { ParserHelper } from "@/app/lib/parser.helper";

test("should run", async () => {

  const country = "ENG";
  const baseCountryRulerAdministrativeAbility = 80;
  const version = "0.0.11";


  const testData = await readReferenceFile(
    `tests/pathfinding/references/${version}/eng_0_0_11.csv`,
  );

  const gameDataFolder = `public/${version}/game_data`;

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
  const roadsJson = await JSON.parse(await fs.readFile(files[2], "utf-8"));
  const roads = ParserHelper.parseRoadFile(roadsJson);
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
  gameStateController.reset(country);
  gameStateController.changeCountryValues({
    rulerAdministrativeAbility: baseCountryRulerAdministrativeAbility,
  });

  const gameState = gameStateController.getSnapshot();

  const costFunction = ProximityComputationHelper.getProximityCostFunction(
    gameState,
    gameData,
    {
      allowUnownedLocations: true,
      /* logForLocations: ['solent', 'seven_sisters'], */
      logMethod: (...args) => {
        console.log(...args);
      },
    },
  );

  const reachable = adjGraph.reachableWithinCost(
    gameState.capitalLocation!,
    100,
    costFunction,
  );


  const pathFromLondonToNewCastle = adjGraph.getShortestPath(
    "london",
    "winchester",
    100,
    costFunction,
  );

  console.log({pathFromLondonToNewCastle});

  // Assert

  const differences: Record<
    ILocationIdentifier,
    { expected: number; actual: number }
  > = {};

  const unrecognisedLocations: ILocationIdentifier[] = [];

  for (const [location, data] of Object.entries(testData)) {
    if (location in gameData.locationDataMap) {
      differences[location] = {
        expected: data,
        actual: ProximityComputationHelper.evaluationToProximity(
          reachable[location]?.cost,
        ),
      };
    } else {
      // exclude locations that do not exist in the game (e.g typo)
      unrecognisedLocations.push(location);
    }
  }

  for (const [location, evaluation] of Object.entries(reachable)) {
    if (!(location in testData) && gameData.countriesDataMap[country].locations.includes(location)) {
      // TODO: figure out exactly the cases we want to measure here.
      // location belonging to country has evaluation > 0 but is not in ref file

      differences[location] = {
        expected: -1,
        actual: ProximityComputationHelper.evaluationToProximity(evaluation.cost)
      }
    }
  }

  const results: Array<{
    location: ILocationIdentifier;
    expected: number;
    actual: number;
    difference: number;
  }> = [];

  for (const [location, { expected, actual }] of Object.entries(differences)) {
    const difference = actual - expected; // Signed difference: positive = actual higher, negative = actual lower
    results.push({
      location,
      expected,
      actual,
      difference,
    });
  }

  // Sort by absolute difference (closest matches first)
  results.sort((a, b) => Math.abs(a.difference) - Math.abs(b.difference));

  const toleratedDifference = 5;
  const goodResults = results.filter((r) => Math.abs(r.difference) <= toleratedDifference);

  console.log(
    "Good results:",
    goodResults.length,
    "/",
    Object.keys(testData).length,
  );

  // Generate HTML report
  await generateHtmlReport(country, version, results, toleratedDifference, unrecognisedLocations);

  const badResults = results.filter(
    (r) => Math.abs(r.difference) > toleratedDifference,
  );

  if (badResults.length > 0)
    throw new Error(
      "The following locations have bad proximity results:\n" +
        badResults
          .map(
            ({ location, actual, expected }) =>
              `${location}: actual=${actual}, expected=${expected}`,
          )
          .join("\n"),
    );
});
