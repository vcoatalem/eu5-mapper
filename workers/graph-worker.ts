import { sendMessage } from "./utils";
import { IWorkerTask } from "./types/workerTypes";
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
            return /* return JSON.parse( */ data /* ) */ as IGameData;
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
  }

  sendMessage(self, {
    data: null,
    message: `Received task: ${JSON.stringify(e.data)} - this is a dummy worker for example sake`,
    level: "log",
    task: e.data,
  });
};
