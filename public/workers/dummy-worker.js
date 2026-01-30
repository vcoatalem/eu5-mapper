"use strict";
(() => {
  // workers/utils.ts
  var sendMessage = (self2, payload) => {
    const workerMessage = {
      type: payload.level,
      taskType: payload.task.type,
      taskId: payload.task.id,
      message: payload.message ?? ""
    };
    if (payload.data !== void 0) {
      workerMessage.data = payload.data;
    }
    self2.postMessage(workerMessage);
  };

  // app/lib/indexeddb/indexeddb-reader.ts
  var IndexedDBReader = class {
    constructor(dbName2, version, storeNames) {
      this.db = null;
      this.dbName = dbName2;
      this.version = version;
      this.storeNames = storeNames;
    }
    async open() {
      if (this.db)
        return this.db;
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);
        request.onupgradeneeded = () => {
        };
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        request.onerror = () => reject(request.error);
      });
    }
    async get(storeName, key) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  };

  // app/lib/indexeddb/indexeddb.const.ts
  var dbName = "eu5-mapapp";
  var dbVersion = 1;
  var dbGameDataStoreName = "gameData";
  var dbAdjacencyDataStoreName = "adjacencyData";
  var dbDataKey = "main";
  var dbStoreNames = [
    dbGameDataStoreName,
    dbAdjacencyDataStoreName
  ];

  // workers/dummy-worker.ts
  var connection = new IndexedDBReader(dbName, dbVersion, dbStoreNames);
  self.onmessage = function(e) {
    switch (e.data.type) {
      case "dummy":
        sendMessage(self, {
          data: null,
          message: `[Dummy Worker] will try to read indexeddb`,
          level: "log",
          task: e.data
        });
        connection.get(dbGameDataStoreName, dbDataKey).then(
          (data) => {
            sendMessage(self, {
              data,
              message: `[Dummy Worker] Fetched data from IndexedDB for task: ${e.data.id} - ${JSON.stringify(data).substring(0, 500)}...`,
              level: "result",
              task: e.data
            });
          },
          (error) => {
            sendMessage(self, {
              level: "error",
              message: `[Dummy Worker] Failed to fetch data from IndexedDB for task: ${e.data.id} - ${error}`,
              task: e.data,
              data: null
            });
          }
        );
    }
    if (e.data.type === "dummy") {
    }
    sendMessage(self, {
      data: null,
      message: `[Dummy Worker] Received task: ${JSON.stringify(e.data)} - this is a dummy worker for example sake`,
      level: "log",
      task: e.data
    });
  };
})();
