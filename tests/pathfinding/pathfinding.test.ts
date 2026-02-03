import { readReferenceFile, generateHtmlReport, getAllReferenceFilePaths, generateIndexFile } from "./utils";
import { IGameData, ILocationIdentifier } from "@/app/lib/types/general";
import { GameStateController } from "@/app/lib/gameState.controller";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";
import { ParserHelper } from "@/app/lib/parser.helper";
import { VersionResolver } from "@/app/lib/versionResolver";
import { GameDataLoaderHelper } from "@/app/lib/gameDataLoader.helper";


const referenceFiles = getAllReferenceFilePaths(
  "tests/pathfinding/references/"
);


test('found reference files', () => {
  console.log("referenceFiles", referenceFiles);
  expect(referenceFiles.length).toBeGreaterThan(0);
});

test.each(referenceFiles)('should do pathfinding evaluation for reference file %s', async (filePath) => {
  const { countryCode, version, rulerAdministrativeAbility, data } = await readReferenceFile(filePath);

  const versionResolver = new VersionResolver();
  await versionResolver.loadVersionsManifest();

  const gameDataFiles = await GameDataLoaderHelper.loadGameDataFilesForVersion(version, versionResolver);
  const gameData: IGameData = {
    ...gameDataFiles
  };
  const adjGraph = ParserHelper.parseAdjacencyCSV(gameDataFiles.adjacencyCsv);
  const gameStateController = new GameStateController();
  gameStateController.init(gameData);
  gameStateController.reset(countryCode);
  gameStateController.changeCountryValues({
    rulerAdministrativeAbility,
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


  // act
  const reachable = adjGraph.reachableWithinCost(
    gameState.capitalLocation!,
    100,
    costFunction,
  );


  // assert

  const differences: Record<
  ILocationIdentifier,
  { expected: number; actual: number }
> = {};

const unrecognisedLocations: ILocationIdentifier[] = [];

for (const [location, expectedProximity] of Object.entries(data)) {
  if (location in gameData.locationDataMap) {
    differences[location] = {
      expected: expectedProximity,
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
  if (!(location in data) && gameData.countriesDataMap[countryCode].locations.includes(location)) {
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
  Object.keys(data).length,
);

// Generate HTML report
await generateHtmlReport(countryCode, version, results, toleratedDifference, unrecognisedLocations);

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

test('generate index file', async () => {
  await generateIndexFile();
});
