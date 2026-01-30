"use strict";
(() => {
  // workers/utils.ts
  var sendMessage = (self2, payload) => {
    const workerMessage = {
      type: payload.level,
      taskType: payload.task.type,
      taskId: payload.task.id,
      message: payload.message ? `[${globalThis.__workerName}] ${payload.message}` : ""
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

  // app/lib/graph.ts
  var CompactGraph = class {
    constructor() {
      this.adjacency = /* @__PURE__ */ new Map();
      this.nodeToId = /* @__PURE__ */ new Map();
      this.idToNode = /* @__PURE__ */ new Map();
      this.nextId = 0;
    }
    _getNodeId(node) {
      if (!this.nodeToId.has(node)) {
        this.nodeToId.set(node, this.nextId);
        this.idToNode.set(this.nextId, node);
        this.nextId++;
      }
      return this.nodeToId.get(node);
    }
    _getNodeString(id) {
      return this.idToNode.get(id);
    }
    _getCanonical(a, b) {
      return a < b ? [a, b] : [b, a];
    }
    addEdge(a, b, isRiver = false, isLand = false, isSea = false, isPort = false, isLake = false) {
      const aId = this._getNodeId(a);
      const bId = this._getNodeId(b);
      const [from, to] = this._getCanonical(aId, bId);
      if (!this.adjacency.has(from)) {
        this.adjacency.set(from, []);
      }
      this.adjacency.get(from).push({
        neighbor: to,
        isRiver,
        isLand,
        isSea,
        isPort,
        isLake
      });
    }
    getEdge(a, b) {
      const aId = this.nodeToId.get(a);
      const bId = this.nodeToId.get(b);
      if (aId === void 0 || bId === void 0) {
        return {
          exists: false,
          isRiver: false,
          isLand: false,
          isSea: false,
          isPort: false,
          isLake: false
        };
      }
      const [from, to] = this._getCanonical(aId, bId);
      const neighbors = this.adjacency.get(from);
      if (!neighbors) {
        return {
          exists: false,
          isRiver: false,
          isLand: false,
          isSea: false,
          isPort: false,
          isLake: false
        };
      }
      const edge = neighbors.find((n) => n.neighbor === to);
      return edge ? {
        exists: true,
        isRiver: edge.isRiver,
        isLand: edge.isLand,
        isSea: edge.isSea,
        isPort: edge.isPort,
        isLake: edge.isLake
      } : {
        exists: false,
        isRiver: false,
        isLand: false,
        isSea: false,
        isPort: false,
        isLake: false
      };
    }
    getNeighborNodesNames(node) {
      const nodeId = this.nodeToId.get(node);
      if (nodeId === void 0)
        return [];
      const neighbors = [];
      if (this.adjacency.has(nodeId)) {
        neighbors.push(...this.adjacency.get(nodeId));
      }
      for (const [from, edges] of this.adjacency.entries()) {
        if (from === nodeId)
          continue;
        for (const edge of edges) {
          if (edge.neighbor === nodeId) {
            neighbors.push({
              neighbor: from,
              isRiver: edge.isRiver,
              isLand: edge.isLand,
              isSea: edge.isSea,
              isPort: edge.isPort,
              isLake: edge.isLake
            });
          }
        }
      }
      return neighbors.map((n) => ({
        name: this._getNodeString(n.neighbor),
        isRiver: n.isRiver,
        isLand: n.isLand,
        isSea: n.isSea,
        isPort: n.isPort,
        isLake: n.isLake
      }));
    }
    reachableWithinCost(startNode, costLimit, getCost) {
      const startId = this.nodeToId.get(startNode);
      if (startId === void 0)
        return /* @__PURE__ */ new Map();
      const distances = /* @__PURE__ */ new Map();
      const pq = [
        { node: startId, cost: 0 }
      ];
      distances.set(startId, 0);
      while (pq.length > 0) {
        pq.sort((a, b) => a.cost - b.cost);
        const current = pq.shift();
        const { node, cost } = current;
        if (cost > costLimit)
          continue;
        if (cost > distances.get(node))
          continue;
        const nodeStr = this._getNodeString(node);
        const neighbors = [];
        if (this.adjacency.has(node)) {
          neighbors.push(...this.adjacency.get(node));
        }
        for (const [from, edges] of this.adjacency.entries()) {
          if (from === node)
            continue;
          for (const edge of edges) {
            if (edge.neighbor === node) {
              neighbors.push({
                neighbor: from,
                isRiver: edge.isRiver,
                isLand: edge.isLand,
                isSea: edge.isSea,
                isPort: edge.isPort,
                isLake: edge.isLake
              });
            }
          }
        }
        for (const {
          neighbor,
          isRiver,
          isLand,
          isSea,
          isPort,
          isLake
        } of neighbors) {
          const neighborStr = this._getNodeString(neighbor);
          const edgeCost = getCost(
            nodeStr,
            neighborStr,
            isRiver,
            isLand,
            isSea,
            isPort,
            isLake
          );
          const newCost = cost + edgeCost;
          if (newCost <= costLimit && (!distances.has(neighbor) || newCost < distances.get(neighbor))) {
            distances.set(neighbor, newCost);
            pq.push({ node: neighbor, cost: newCost });
          }
        }
      }
      const result = /* @__PURE__ */ new Map();
      for (const [id, dist] of distances.entries()) {
        result.set(this._getNodeString(id), dist);
      }
      return result;
    }
    getStats() {
      let totalEdges = 0;
      let riverEdges = 0;
      let landEdges = 0;
      let seaEdges = 0;
      let portEdges = 0;
      let lakeEdges = 0;
      for (const neighbors of this.adjacency.values()) {
        totalEdges += neighbors.length;
        riverEdges += neighbors.filter((n) => n.isRiver).length;
        landEdges += neighbors.filter((n) => n.isLand).length;
        seaEdges += neighbors.filter((n) => n.isSea).length;
        portEdges += neighbors.filter((n) => n.isPort).length;
        lakeEdges += neighbors.filter((n) => n.isLake).length;
      }
      return {
        nodes: this.adjacency.size,
        edges: totalEdges,
        riverEdges,
        landEdges,
        seaEdges,
        portEdges,
        lakeEdges
      };
    }
  };

  // app/lib/parser.helper.ts
  var ParserHelper = class {
    /**
     * Parses adjacency CSV data and builds a CompactGraph
     * @param csvContent The raw CSV content as a string
     * @returns A populated CompactGraph instance
     */
    static parseAdjacencyCSV(csvContent) {
      const graph2 = new CompactGraph();
      const lines = csvContent.trim().split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
          continue;
        const [locationA, locationB, accessType] = line.split(",");
        const isRiver = accessType === "river";
        const isLand = accessType === "land";
        const isSea = accessType === "sea";
        const isPort = accessType === "port";
        const isLake = accessType === "lake";
        graph2.addEdge(
          locationA,
          locationB,
          isRiver,
          isLand,
          isSea,
          isPort,
          isLake
        );
      }
      return graph2;
    }
  };

  // workers/graph-worker.ts
  var connection = new IndexedDBReader(dbName, dbVersion, dbStoreNames);
  globalThis.__workerName = "Graph Worker";
  var gameData = null;
  var graph = null;
  self.onmessage = async function(e) {
    switch (e.data.type) {
      case "initGraphWorker":
        try {
          sendMessage(self, {
            data: null,
            message: "Init Graph Worker with indexedDB data",
            level: "log",
            task: e.data
          });
          gameData = await connection.get(dbGameDataStoreName, dbDataKey).then(
            (data) => {
              return (
                /* return JSON.parse( */
                data
              );
            },
            (error) => {
              throw new Error(`Failed to fetch data from IndexedDB: ${error}`);
            }
          );
          graph = await connection.get(dbAdjacencyDataStoreName, dbDataKey).then(
            (data) => {
              return ParserHelper.parseAdjacencyCSV(data);
            },
            (error) => {
              throw new Error(
                `Failed to fetch adjacency data from IndexedDB: ${error}`
              );
            }
          );
          sendMessage(self, {
            level: "result",
            message: "Graph Worker initialized successfully",
            data: {
              graphStats: graph.getStats()
            },
            task: e.data
          });
        } catch (err) {
          sendMessage(self, {
            message: `Error initializing graph worker: ${err.message}`,
            level: "error",
            task: e.data
          });
        }
    }
    sendMessage(self, {
      data: null,
      message: `Received task: ${JSON.stringify(e.data)} - this is a dummy worker for example sake`,
      level: "log",
      task: e.data
    });
  };
})();
