import { sendMessage } from "./utils";
import { IWorkerTask } from "./types/workerTypes";
import { IndexedDBReader } from "../app/lib/indexeddb/indexeddb-reader";
import {
  dbDataKey,
  dbGameDataStoreName,
  dbName,
  dbStoreNames,
  dbVersion,
} from "../app/lib/indexeddb/indexeddb.const";

const connection = new IndexedDBReader(dbName, dbVersion, dbStoreNames);

self.onmessage = function (e: MessageEvent<IWorkerTask>) {
  switch (e.data.type) {
    case "dummy":
      sendMessage(self, {
        data: null,
        message: `[Dummy Worker] will try to read indexeddb`,
        level: "log",
        task: e.data,
      });
      connection.get(dbGameDataStoreName, dbDataKey).then(
        (data) => {
          sendMessage(self, {
            data: data,
            message: `[Dummy Worker] Fetched data from IndexedDB for task: ${e.data.id} - ${JSON.stringify(data).substring(0, 500)}...`,
            level: "result",
            task: e.data,
          });
        },
        (error) => {
          sendMessage(self, {
            level: "error",
            message: `[Dummy Worker] Failed to fetch data from IndexedDB for task: ${e.data.id} - ${error}`,
            task: e.data,
            data: null,
          });
        },
      );
  }
  if (e.data.type === "dummy") {
  }

  sendMessage(self, {
    data: null,
    message: `[Dummy Worker] Received task: ${JSON.stringify(e.data)} - this is a dummy worker for example sake`,
    level: "log",
    task: e.data,
  });
};
