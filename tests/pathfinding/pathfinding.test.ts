import {
  GameDataVersion,
  ZodGameDataVersion,
} from "@/app/config/gameData.config";
import {
  GameDataLoaderHelper,
  IGameDataParsedFiles,
} from "@/app/lib/gameDataLoader.helper";
import { GameStateController } from "@/app/lib/gameState.controller";
import { CompactGraph } from "@/app/lib/graph";
import { ParserHelper } from "@/app/lib/parser.helper";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";
import { GameData, LocationIdentifier } from "@/app/lib/types/general";
import { VersionManifest } from "@/app/lib/types/versionsManifest";
import {
  generateHtmlReport,
  generateIndexFile,
  getAllReferenceFilePaths,
  readReferenceFileSync,
  ReferenceFile,
} from "./utils";
import { ObjectHelper } from "@/app/lib/object.helper";

const referenceFiles = getAllReferenceFilePaths(
  "tests/pathfinding/references/",
); /* .filter((filePath) => filePath.includes("eng") && filePath.includes('1_1_4'));// && filePath.includes('1_0_11')); */

const groupByVersion = <T extends { version: GameDataVersion }>(items: T[]) => {
  const map: Partial<Record<GameDataVersion, T[]>> = {};
  for (const item of items) {
    if (item.version in map) {
      map[item.version]?.push(item);
    } else {
      map[item.version] = [item];
    }
  }
  return ObjectHelper.getTypedEntries(map).map(([version, refs]) => ({
    version,
    refs,
  }));
};

const allReferences = referenceFiles.map(readReferenceFileSync);
const byVersion: Array<{ version: GameDataVersion; refs: ReferenceFile[] }> =
  groupByVersion(allReferences);

console.log({ byVersion });
afterAll(async () => {
  await generateIndexFile();
});

test("found reference files", () => {
  console.log("referenceFiles", referenceFiles);
  expect(referenceFiles.length).toBeGreaterThan(0);
});

describe("pathfinding references", () => {
  describe.each(byVersion)("game version: $version", ({ version, refs }) => {
    let manifest: VersionManifest;
    let gameFiles: IGameDataParsedFiles;
    let graph: CompactGraph;

    // Load heavy version-scoped data once per version.
    beforeAll(async () => {
      manifest = await GameDataLoaderHelper.loadManifestForVersion(version);
      gameFiles = await GameDataLoaderHelper.loadGameDataFilesForVersion(
        version,
        manifest,
      );
      gameFiles.countryModifiersTemplate =
        await GameDataLoaderHelper.loadGameDataFileForVersion(
          version,
          "countryModifiersTemplate",
          manifest,
        );
      graph = ParserHelper.parseAdjacencyCSV(gameFiles.adjacencyCsv);
    });

    test.each(refs)("$name", async (ref) => {
      await runPathfindingCase(ref, {
        version,
        parsedGameFiles: gameFiles,
        adjacencyGraph: graph,
      });
    });
  });
});

async function runPathfindingCase(
  ref: ReferenceFile,
  context: {
    version: GameDataVersion;
    parsedGameFiles: IGameDataParsedFiles;
    adjacencyGraph: CompactGraph;
  },
): Promise<void> {
  const { version, parsedGameFiles, adjacencyGraph } = context;
  const gameData: GameData = {
    locationDataMap: parsedGameFiles.locationData.map,
    proximityComputationRule: parsedGameFiles.proximityComputationRule,
    countriesData: parsedGameFiles.countriesData,
    roads: parsedGameFiles.roads,
    buildingsTemplate: parsedGameFiles.buildingsTemplate,
    colorToNameMap: {}, // not needed for pathfinding
  };

  const gameStateController = new GameStateController();
  gameStateController.init(gameData, version);
  gameStateController.reset(ref.countryCode);
  gameStateController.changeCountryRulerAdministrativeAbility(
    ref.rulerAdministrativeAbility,
  );
  if (Object.keys(ref.countryValuesOverrides).length > 0) {
    gameStateController.changeCountryValues(ref.countryValuesOverrides);
  }

  const countryModifiersTemplates = parsedGameFiles.countryModifiersTemplate;
  for (const modifier of ref.modifiers) {
    const modifierTemplate = countryModifiersTemplates[modifier];
    if (!modifierTemplate) {
      throw new Error(`Modifier template not found for modifier: ${modifier}`);
    }
    gameStateController.changeCountryModifier(modifier, {
      enabled: true,
      buff: modifierTemplate?.buff ?? {},
    });
  }

  const gameState = gameStateController.getSnapshot();

  const costFunction = ProximityComputationHelper.getProximityCostFunction(
    gameState,
    gameData,
    {
      allowUnownedLocations: true,
      logForLocations: [],
      logMethod: (message: string, data?: Record<string, unknown>) => {
        console.log(message, data);
      },
    },
  );

  // act
  const reachable = adjacencyGraph.reachableWithinCost(
    gameState.capitalLocation!,
    100,
    costFunction,
  );

  // assert

  const differences: Record<
    LocationIdentifier,
    { expected: number; actual: number }
  > = {};

  const unrecognisedLocations: LocationIdentifier[] = [];

  for (const [location, expectedProximity] of Object.entries(ref.data)) {
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
    if (
      !(location in ref.data) &&
      gameData.countriesData[ref.countryCode].locations.includes(location)
    ) {
      // TODO: figure out exactly the cases we want to measure here.
      // location belonging to country has evaluation > 0 but is not in ref file
      differences[location] = {
        expected: -1,
        actual: ProximityComputationHelper.evaluationToProximity(
          evaluation.cost,
        ),
      };
    }
  }

  const results: Array<{
    location: LocationIdentifier;
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

  results.sort((a, b) => {
    const expectedDiff = b.expected - a.expected;
    if (expectedDiff !== 0) return expectedDiff;
    return Math.abs(a.difference) - Math.abs(b.difference);
  });

  const toleratedDifference = 5;
  const goodResults = results.filter(
    (r) => Math.abs(r.difference) <= toleratedDifference,
  );

  console.log(
    "Good results:",
    goodResults.length,
    "/",
    Object.keys(ref.data).length,
  );

  // Generate HTML report
  await generateHtmlReport(
    ref.countryCode,
    version,
    results,
    toleratedDifference,
    unrecognisedLocations,
    {
      rulerAdministrativeAbility: ref.rulerAdministrativeAbility,
      modifiers: ref.modifiers,
      countryValuesOverrides: ref.countryValuesOverrides,
    },
  );

  const successRate = goodResults.length / Object.keys(ref.data).length;
  if (successRate < 0.9) {
    throw new Error(
      `Success rate too low for reference ${ref.countryCode}: ${successRate}`,
    );
  }
}
