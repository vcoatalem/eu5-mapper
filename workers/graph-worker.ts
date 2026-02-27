import { sendMessage } from "./utils";
import {
  IWorkerTask,
  IWorkerTaskComputeNeighborsPayload,
  IWorkerTaskComputeNeighborsResult,
  IWorkerTaskComputeProximityPayload,
  IWorkerTaskComputeProximityResult,
  IWorkerTaskcomputeShortestPathFromProximitySourcePayload,
  IWorkerTaskcomputeShortestPathFromProximitySourceResult,
} from "./types/workerTypes";
import { IndexedDBReader } from "../app/lib/indexeddb/indexeddb-reader";
import {
  dbAdjacencyDataStoreName,
  dbDataKey,
  dbGameDataStoreName,
  dbName,
  dbStoreNames,
  dbVersion,
} from "../app/lib/indexeddb/indexeddb.const";
import { IGameData } from "@/app/lib/types/general";
import { CompactGraph } from "@/app/lib/graph";
import { ParserHelper } from "@/app/lib/parser.helper";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";
import { ProximityBuffsRecord } from "@/app/lib/classes/countryProximityBuffs";

const connection = new IndexedDBReader(dbName, dbVersion, dbStoreNames);

(globalThis as any).__workerName = "Graph Worker";

let gameData: IGameData | null = null;
let graph: CompactGraph | null = null;

self.onmessage = async function (e: MessageEvent<IWorkerTask>) {
  switch (e.data.type) {
    case "initGraphWorker":
      try {
        sendMessage(self, {
          data: null,
          message: "Init Graph Worker with indexedDB data",
          level: "log",
          task: e.data,
        });
        gameData = await connection.get(dbGameDataStoreName, dbDataKey).then(
          (data) => {
            return data as IGameData;
          },
          (error) => {
            throw new Error(`Failed to fetch data from IndexedDB: ${error}`);
          },
        );
        graph = await connection.get(dbAdjacencyDataStoreName, dbDataKey).then(
          (data) => {
            return ParserHelper.parseAdjacencyCSV(data);
          },
          (error) => {
            throw new Error(
              `Failed to fetch adjacency data from IndexedDB: ${error}`,
            );
          },
        );

        sendMessage(self, {
          level: "result",
          message: "Graph Worker initialized successfully",
          data: {
            graphStats: graph.getStats(),
          },
          task: e.data,
        });
      } catch (err) {
        sendMessage(self, {
          message: `Error initializing graph worker: ${(err as any).message}`,
          level: "error",
          task: e.data,
        });
      }
      break;
    case "computeProximity":
      try {
        if (!gameData || !graph) {
          throw new Error("Graph Worker not initialized.");
        }
        const taskPayload = e.data
          .payload as IWorkerTaskComputeProximityPayload;
        const { gameState } = taskPayload;
        if (!gameState.capitalLocation) {
          sendMessage(self, {
            message:
              "No capital location defined for the country - skipping computation",
            level: "result",
            task: {
              id: e.data.id,
              type: e.data.type,
              payload: e.data,
            },
            data: { result: {} },
          });
          return;
        }

        // debug log of proximity modifiers
        const proximityBuffs = new ProximityBuffsRecord(
          gameData.proximityComputationRule,
          gameState.country,
        );

        const landProximityBuffs =
          proximityBuffs.getBuffsOfType("landModifier");
        const seaProximityBuffs = proximityBuffs.getBuffsOfType(
          "seaWithMaritimeFlatCostReduction",
        );
        sendMessage(self, {
          data: { proximityBuffs, landProximityBuffs, seaProximityBuffs },
          message: "Proximity buffs computed",
          level: "log",
          task: e.data,
        });

        const resultPayload: IWorkerTaskComputeProximityResult = {
          result: ProximityComputationHelper.getGameStateProximityComputation(
            gameState,
            gameData,
            graph,
            {
              allowUnownedLocations: true, // allow passing over unowned
              logForLocations: [
                /* "strait_of_dover", "windsor" */
              ],
              logMethod: (message: string, data?: Record<string, unknown>) => {
                sendMessage(self, {
                  data: data ?? null,
                  message: message,
                  level: "log",
                  task: e.data,
                });
              },
            },
          ),
        };

        sendMessage(self, {
          data: resultPayload,
          message: "Proximity computation completed",
          level: "result",
          task: e.data,
        });
      } catch (err) {
        sendMessage(self, {
          message: `Error during proximity computation: ${(err as any).message}`,
          level: "error",
          task: e.data,
        });
      }
      break;
    case "computeNeighbors":
      try {
        if (!gameData || !graph) {
          throw new Error("Graph Worker not initialized.");
        }
        const taskPayload = e.data
          .payload as IWorkerTaskComputeNeighborsPayload;
        const { gameState, locationName } = taskPayload;
        const neighborEval: IWorkerTaskComputeNeighborsResult = {
          locationName,
          neighbors:
            ProximityComputationHelper.getGameStateLocationNeighborsProximity(
              locationName,
              gameState,
              gameData,
              graph,
              {
                allowUnownedLocations: true, // allow passing over unowned
                logForLocations: [
                  /* "strait_of_dover" */
                ],
                logMethod: (
                  message: string,
                  data?: Record<string, unknown>,
                ) => {
                  sendMessage(self, {
                    data: data ?? null,
                    message: message,
                    level: "log",
                    task: e.data,
                  });
                },
              },
            ),
        };
        sendMessage(self, {
          data: neighborEval,
          message: "Neighbors computation completed",
          level: "result",
          task: e.data,
        });
      } catch (err) {
        sendMessage(self, {
          message: `Error during neighbors computation: ${(err as any).message}`,
          level: "error",
          task: e.data,
        });
      }
      break;
    case "computeShortestPathFromProximitySource":
      try {
        if (!gameData || !graph) {
          throw new Error("Graph Worker not initialized.");
        }

        const taskPayload = e.data
          .payload as IWorkerTaskcomputeShortestPathFromProximitySourcePayload;
        const { gameState, targetLocationName } = taskPayload;

        const shortestPathResult =
          ProximityComputationHelper.getPathFromClosestProximitySource(
            targetLocationName,
            gameState,
            gameData,
            graph,
            {
              allowUnownedLocations: true,
              logMethod: (message: string, data?: Record<string, unknown>) => {
                sendMessage(self, {
                  data: data ?? null,
                  message: message,
                  level: "log",
                  task: e.data,
                });
              },
            },
          );

        const resultPayload: IWorkerTaskcomputeShortestPathFromProximitySourceResult =
          {
            location: targetLocationName,
            shortestPath:
              shortestPathResult === null
                ? null
                : {
                    sourceLocation: shortestPathResult.sourceLocation,
                    proximity: shortestPathResult.proximity,
                    path: shortestPathResult.path,
                  },
          };

        sendMessage(self, {
          data: resultPayload,
          message: "Shortest path to proximity source computation completed",
          level: "result",
          task: e.data,
        });
      } catch (err) {
        sendMessage(self, {
          message: `Error during shortest path to proximity source computation: ${(err as any).message}`,
          level: "error",
          task: e.data,
        });
      }
      break;
  }
};
