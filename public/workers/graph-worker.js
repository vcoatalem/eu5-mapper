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
      this.adjacency = {};
      this.nodeToId = {};
      this.idToNode = {};
      this.nextId = 0;
    }
    _getNodeId(node) {
      if (!(node in this.nodeToId)) {
        this.nodeToId[node] = this.nextId;
        this.idToNode[this.nextId] = node;
        this.nextId++;
      }
      return this.nodeToId[node];
    }
    _getNodeString(id) {
      return this.idToNode[id];
    }
    _getCanonical(a, b) {
      return a < b ? [a, b] : [b, a];
    }
    addEdge(a, b, edgeType) {
      const aId = this._getNodeId(a);
      const bId = this._getNodeId(b);
      const [from, to] = this._getCanonical(aId, bId);
      if (!(from in this.adjacency)) {
        this.adjacency[from] = [];
      }
      this.adjacency[from].push({
        neighbor: to,
        edgeType
      });
    }
    getEdge(a, b) {
      const aId = this.nodeToId[a];
      const bId = this.nodeToId[b];
      if (aId === void 0 || bId === void 0) {
        return {
          exists: false,
          type: "unknown"
        };
      }
      const [from, to] = this._getCanonical(aId, bId);
      const neighbors = this.adjacency[from];
      if (!neighbors) {
        return {
          exists: false,
          type: "unknown"
        };
      }
      const edge = neighbors.find((n) => n.neighbor === to);
      return edge ? {
        exists: true,
        type: edge.edgeType
      } : {
        exists: false,
        type: "unknown"
      };
    }
    reachableWithinCost(startNode, costLimit, getCost) {
      const startId = this.nodeToId[startNode];
      if (startId === void 0)
        return {};
      const distances = {};
      const pq = [
        { node: startId, cost: 0 }
      ];
      distances[startId] = { cost: 0, through: "unknown" };
      while (pq.length > 0) {
        pq.sort((a, b) => a.cost - b.cost);
        const current = pq.shift();
        const { node, cost } = current;
        if (cost > costLimit)
          continue;
        if (cost > distances[node].cost)
          continue;
        const nodeStr = this._getNodeString(node);
        const neighbors = [];
        if (node in this.adjacency) {
          neighbors.push(...this.adjacency[node]);
        }
        for (const fromStr in this.adjacency) {
          const from = Number(fromStr);
          if (from === node)
            continue;
          const edges = this.adjacency[from];
          for (const edge of edges) {
            if (edge.neighbor === node) {
              neighbors.push({
                neighbor: from,
                edgeType: edge.edgeType
              });
            }
          }
        }
        for (const { neighbor, edgeType } of neighbors) {
          const neighborStr = this._getNodeString(neighbor);
          const edgeCost = getCost(nodeStr, neighborStr, edgeType);
          const newCost = cost + edgeCost.cost;
          if (newCost <= costLimit && (!(neighbor in distances) || newCost < distances[neighbor].cost)) {
            distances[neighbor] = { cost: newCost, through: edgeCost.through };
            pq.push({ node: neighbor, cost: newCost });
          }
        }
      }
      const result = {};
      for (const idStr in distances) {
        const id = Number(idStr);
        result[this._getNodeString(id)] = distances[id];
      }
      return result;
    }
    /**
     * Returns a map of all nodes reachable from startNode within a given number of edges (no cycles),
     * with the minimum cost to each node. Similar to reachableWithinCost, but uses edge count as the limit.
     */
    reachableWithinEdges(startNode, edgeLimit, getCost) {
      const startId = this.nodeToId[startNode];
      if (startId === void 0)
        return {};
      const minCost = {};
      const queue = [
        { node: startId, cost: 0, edgesUsed: 0, visited: /* @__PURE__ */ new Set([startId]) }
      ];
      minCost[startId] = { cost: 0, through: "unknown" };
      while (queue.length > 0) {
        const current = queue.shift();
        const { node, cost, edgesUsed, visited } = current;
        if (edgesUsed >= edgeLimit)
          continue;
        const neighbors = [];
        if (node in this.adjacency) {
          neighbors.push(...this.adjacency[node]);
        }
        for (const [from, edges] of Object.entries(this.adjacency)) {
          const fromNum = Number(from);
          if (fromNum === node)
            continue;
          for (const edge of edges) {
            if (edge.neighbor === node) {
              neighbors.push({
                neighbor: fromNum,
                edgeType: edge.edgeType
                /*  isRiver: edge.isRiver,
                isLand: edge.isLand,
                isSea: edge.isSea,
                isPort: edge.isPort,
                isLake: edge.isLake, */
              });
            }
          }
        }
        for (const {
          neighbor,
          edgeType
          /*  isRiver,
          isLand,
          isSea,
          isPort,
          isLake, */
        } of neighbors) {
          if (visited.has(neighbor))
            continue;
          const neighborStr = this._getNodeString(neighbor);
          const edgeCost = getCost(
            this._getNodeString(node),
            neighborStr,
            edgeType
            /*  isLand,
            isSea,
            isPort,
            isLake, */
          );
          const newCost = cost + edgeCost.cost;
          if (!(neighbor in minCost) || newCost < minCost[neighbor].cost) {
            minCost[neighbor] = { cost: newCost, through: edgeCost.through };
            const newVisited = new Set(visited);
            newVisited.add(neighbor);
            queue.push({
              node: neighbor,
              cost: newCost,
              edgesUsed: edgesUsed + 1,
              visited: newVisited
            });
          }
        }
      }
      const result = {};
      for (const idStr in minCost) {
        const id = Number(idStr);
        result[this._getNodeString(id)] = {
          cost: minCost[id].cost,
          through: minCost[id].through
        };
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
      let portRiverEdges = 0;
      for (const key in this.adjacency) {
        const neighbors = this.adjacency[key];
        totalEdges += neighbors.length;
        riverEdges += neighbors.filter((n) => n.edgeType === "river").length;
        landEdges += neighbors.filter((n) => n.edgeType === "land").length;
        seaEdges += neighbors.filter((n) => n.edgeType === "sea").length;
        portEdges += neighbors.filter((n) => n.edgeType === "port").length;
        lakeEdges += neighbors.filter((n) => n.edgeType === "lake").length;
        portRiverEdges += neighbors.filter(
          (n) => n.edgeType === "port-river"
        ).length;
      }
      return {
        nodes: Object.keys(this.adjacency).length,
        edges: totalEdges,
        riverEdges,
        landEdges,
        seaEdges,
        portEdges,
        lakeEdges,
        portRiverEdges
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
        const [locationA, locationB, edgeType] = line.split(",");
        if (["river", "land", "sea", "port", "lake", "port-river"].includes(
          edgeType
        ) === false) {
          throw new Error(
            `Invalid edge type "${edgeType}" in adjacency CSV at line ${i + 1}`
          );
        }
        graph2.addEdge(locationA, locationB, edgeType);
      }
      return graph2;
    }
    static parseRoadFile(jsonContent) {
      const roadRecord = {};
      for (const roadEntry of jsonContent) {
        const [from, to] = roadEntry;
        if (roadRecord[from] === void 0) {
          roadRecord[from] = [];
        }
        if (roadRecord[to] === void 0) {
          roadRecord[to] = [];
        }
        roadRecord[from].push({
          to,
          type: "gravel",
          createdByUser: false
        });
        roadRecord[to].push({
          to: from,
          type: "gravel",
          createdByUser: false
        });
      }
      return roadRecord;
    }
  };

  // app/lib/proximityComputation.helper.ts
  var logProximityComputation = (location, options, message, data) => {
    if (!options.logMethod || !options.logForLocations)
      return;
    const locationsToCheck = Array.isArray(location) ? location : [location];
    const shouldLog = locationsToCheck.some((loc) => options.logForLocations.includes(loc));
    if (shouldLog) {
      const locationData = Array.isArray(location) ? { locations: location } : { location };
      const logMessage = message ? `[ProximityComputationHelper] ${message}` : "[ProximityComputationHelper]";
      const mergedData = data ? { ...locationData, ...data } : locationData;
      options.logMethod(logMessage, mergedData);
    }
  };
  var _ProximityComputationHelper = class _ProximityComputationHelper {
    static getLocalProximitySourceLocations(gameState) {
      const proximitySourceLocations = {};
      for (const locationName of Object.keys(gameState.ownedLocations)) {
        if (gameState.capitalLocation === locationName) {
          proximitySourceLocations[locationName] = 100;
        } else {
          const locationBuildings = gameState.ownedLocations[locationName].buildings;
          const highestProximitySource = Math.max(
            ...locationBuildings.map(
              (b) => b.template.localProximitySource?.[b.level - 1] || 0
            )
          );
          if (highestProximitySource > 0) {
            proximitySourceLocations[locationName] = highestProximitySource;
          }
        }
      }
      return proximitySourceLocations;
    }
    static getFlatProximityCost(edgeType, gameState, rule, maritimePresence, roadToDestination) {
      const baseCost = edgeType.includes("river") ? rule.baseRiverCost : rule.baseCost;
      const isImpactedByRoad = edgeType === "land";
      const isNaval = edgeType === "sea" || edgeType === "lake";
      const flatProximityCostReduction = [
        isNaval && gameState.country.landVsNaval > 0 ? rule.valuesImpact.landVsNaval[1].flatModifier * gameState.country.landVsNaval / 100 : 0,
        isImpactedByRoad && roadToDestination ? rule.roadProximityCostReduction[roadToDestination] : 0
        // TODO: advances ?
      ].reduce((a, b) => a + b, 0);
      if (!isNaval) {
        return baseCost - flatProximityCostReduction;
      } else {
        let normalizedMaritimePresence = edgeType === "lake" ? 1 : maritimePresence / 100;
        normalizedMaritimePresence = Math.max(
          0,
          Math.min(1, normalizedMaritimePresence)
        );
        const flatProximityCostWithoutMaritimePresence = [
          // ... advances
        ].reduce((a, b) => a + b, 0);
        const flatProximityCostWithMaritimePresence = [
          // ... advances
        ].reduce((a, b) => a + b, 0);
        const costWithoutMaritimePresence = rule.baseCostWithoutMaritimePresence - flatProximityCostWithoutMaritimePresence;
        const costWithMaritimePresence = rule.baseCostWithMaritimePresence - flatProximityCostWithMaritimePresence;
        return costWithoutMaritimePresence * (1 - normalizedMaritimePresence) + costWithMaritimePresence * normalizedMaritimePresence;
      }
    }
    static getTransportationModeProximityCostModifiers(from, to, transportationMode, gameData2, gameState, options) {
      switch (transportationMode) {
        case "land":
          if (from in gameState.ownedLocations || options.allowUnownedLocations) {
            return _ProximityComputationHelper.getLandLocationProximityModifiers(
              gameData2.locationDataMap[from],
              gameState.ownedLocations[from],
              gameData2,
              gameState.country
            );
          } else {
            return 0;
          }
        case "harbor":
          const toLocation = gameData2.locationDataMap[to];
          const locationWithHarbor = toLocation.isSea ? from : to;
          const harborCapacity = _ProximityComputationHelper.getLocationHarborCapacity(
            gameData2.locationDataMap[locationWithHarbor],
            gameState.ownedLocations[locationWithHarbor],
            options
          );
          const harborImpact = gameData2.proximityComputationRule.harborCapacityImpact;
          const proximityModifier = harborImpact * harborCapacity * 100;
          return proximityModifier;
        case "naval":
        default:
          return 0;
      }
    }
    static getGenericCountryProximityCostModifiers(country, rule) {
      return [
        country.centralizationVsDecentralization < 0 ? Math.abs(country.centralizationVsDecentralization) * rule.valuesImpact.centralizationVsDecentralization[0].percentageModifier / 100 : 0,
        country.rulerAdministrativeAbility * rule.rulerAdministrativeAbilityImpact
      ].reduce((a, b) => a + b, 0);
    }
    static getPercentageProximityCostModifiers(from, to, edgeType, gameData2, gameState, options) {
      const modifiers = [];
      const toLocationData = gameData2.locationDataMap[to];
      const isNaval = toLocationData.isSea || toLocationData.isLake;
      const transportationMode = edgeType === "port" || edgeType === "port-river" ? "harbor" : isNaval ? "naval" : "land";
      modifiers.push(
        this.getTransportationModeProximityCostModifiers(
          from,
          to,
          transportationMode,
          gameData2,
          gameState,
          options
        ),
        this.getGenericCountryProximityCostModifiers(
          gameState.country,
          gameData2.proximityComputationRule
        )
      );
      logProximityComputation(
        [from, to],
        options,
        "Proximity cost modifiers",
        { from, to, isNaval, modifiers }
      );
      return modifiers.reduce((a, b) => a + b, 0);
    }
    static getProximityCostFunction(gameState, gameData2, options) {
      return (from, to, edgeType) => {
        const rule = gameData2.proximityComputationRule;
        const [locationA, locationB] = [from, to].sort();
        const road = gameData2.roads[locationA]?.find(
          ({ to: to2 }) => to2 === locationB
        );
        const maritimePresence = 30;
        const baseCost = this.getFlatProximityCost(
          edgeType,
          gameState,
          rule,
          maritimePresence,
          road?.type ?? null
        );
        const toLocationData = gameData2.locationDataMap[to];
        const isToSeaZone = toLocationData.isSea;
        const isToLakeZone = toLocationData.isLake;
        if (!options.allowUnownedLocations && !Object.keys(gameState.ownedLocations).includes(to) && !isToSeaZone && !isToLakeZone) {
          return { cost: 100, through: edgeType };
        }
        const proximityModifiersSummed = this.getPercentageProximityCostModifiers(
          from,
          to,
          edgeType,
          gameData2,
          gameState,
          options
        );
        const modifiedCost = baseCost * (1 - proximityModifiersSummed / 100);
        logProximityComputation(
          [from, to],
          options,
          "Final proximity cost",
          {
            from,
            to,
            edgeType,
            modifiedCost,
            proximityModifiersSummed
          }
        );
        return {
          cost: modifiedCost,
          through: edgeType
        };
      };
    }
    /**
     * converts pathfinding evaluation to "proximity" value as displayed in-game
     */
    static evaluationToProximity(evaluationCost) {
      if (isNaN(evaluationCost))
        return 0;
      const proximity = Math.max(0, 100 - evaluationCost).toFixed(2);
      return Number(proximity);
    }
  };
  _ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage = (location, gameData2, roadToDestination) => {
    const rule = gameData2.proximityComputationRule;
    if (!Object.keys(rule.proximityCostIncreasePercentage.topography).includes(
      location.topography
    )) {
      console.warn(
        "[ProximityComputationController] Missing topography proximity cost increase percentage for ",
        location.topography
      );
    }
    const topographyCostIncreasePercentage = rule.proximityCostIncreasePercentage.topography?.[location.topography] ?? 0;
    if (location.vegetation && !Object.keys(rule.proximityCostIncreasePercentage.vegetation).includes(
      location?.vegetation
    )) {
      console.warn(
        "[ProximityComputationController] Missing vegetation proximity cost increase percentage for ",
        location.vegetation
      );
    }
    const vegetationCostIncreasePercentage = location.vegetation && !roadToDestination ? rule.proximityCostIncreasePercentage.vegetation?.[location.vegetation] ?? 0 : 0;
    const totalEnvironmentalCostIncrease = topographyCostIncreasePercentage + vegetationCostIncreasePercentage;
    return totalEnvironmentalCostIncrease;
  };
  _ProximityComputationHelper.getLandLocationProximityModifiers = (location, locationConstructibleData, gameData2, country) => {
    if (location.isSea || location.isLake || !location.ownable) {
      return 0;
    }
    const buildings = locationConstructibleData?.buildings ?? [];
    const totalBuildingsCostReduction = buildings.map(
      (b) => b.template.proximityCostReductionPercentage?.[b.level - 1] ?? 0
    ).reduce((a, b) => a + b, 0);
    const environmentalProximityCostIncreasePercentage = _ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage(
      location,
      gameData2
    );
    const development = location.development;
    const developmentCostReduction = development * gameData2.proximityComputationRule.developmentImpact;
    const countryLandProximityModifiers = [
      country.landVsNaval < 0 ? Math.abs(country.landVsNaval) * gameData2.proximityComputationRule.valuesImpact.landVsNaval[0].percentageModifier / 100 : 0
    ];
    const countryLandProximityReduction = countryLandProximityModifiers.reduce(
      (a, b) => a + b,
      0
    );
    const total = (
      // positive proximity (cost reduction)
      totalBuildingsCostReduction + countryLandProximityReduction + developmentCostReduction - // negative proximity (cost increase)
      environmentalProximityCostIncreasePercentage
    );
    return total;
  };
  _ProximityComputationHelper.getLocationHarborCapacity = (locationData, locationConstructibleData, options) => {
    logProximityComputation(
      locationData.name,
      options,
      "Enter location harbor capacity calculation",
      { locationConstructibleData }
    );
    const naturalHarborSuitability = locationData.naturalHarborSuitability ?? 0;
    if (!locationConstructibleData) {
      return naturalHarborSuitability;
    }
    const buildings = locationConstructibleData.buildings ?? [];
    const totalBuildingsHarborCapacity = buildings.map((b) => {
      const capacity = b.template.harborCapacity?.[b.level - 1];
      return capacity || 0;
    }).reduce((a, b) => a + b, 0);
    logProximityComputation(
      locationData.name,
      options,
      "Harbor capacity",
      { locationConstructibleData, totalBuildingsHarborCapacity, naturalHarborSuitability }
    );
    return naturalHarborSuitability + totalBuildingsHarborCapacity;
  };
  _ProximityComputationHelper.getGameStateProximityComputation = (gameState, gameData2, adjacencyGraph, options) => {
    const proximityResults = {};
    const proximitySourceLocations = _ProximityComputationHelper.getLocalProximitySourceLocations(gameState);
    for (const [locationName, proximitySource] of Object.entries(
      proximitySourceLocations
    )) {
      proximityResults[locationName] = adjacencyGraph.reachableWithinCost(
        locationName,
        proximitySource,
        _ProximityComputationHelper.getProximityCostFunction(
          gameState,
          gameData2,
          options
        )
      );
    }
    const mergedResults = {};
    for (const [location, resultMap] of Object.entries(proximityResults)) {
      for (const [target, result] of Object.entries(resultMap)) {
        const deducedCost = 100 - proximitySourceLocations[location] + result.cost;
        if (!(target in mergedResults) || deducedCost < mergedResults[target].cost) {
          mergedResults[target] = {
            cost: deducedCost,
            through: result.through
          };
        }
      }
    }
    return mergedResults;
  };
  _ProximityComputationHelper.getGameStateLocationNeighborsProximity = (location, gameState, gameData2, adjacencyGraph, options) => {
    const neighbors = adjacencyGraph.reachableWithinEdges(
      location,
      1,
      _ProximityComputationHelper.getProximityCostFunction(
        gameState,
        gameData2,
        options
      )
    );
    return neighbors;
  };
  var ProximityComputationHelper = _ProximityComputationHelper;

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
              return data;
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
        break;
      case "computeProximity":
        try {
          if (!gameData || !graph) {
            throw new Error("Graph Worker not initialized.");
          }
          const taskPayload = e.data.payload;
          const { gameState } = taskPayload;
          const resultPayload = {
            result: ProximityComputationHelper.getGameStateProximityComputation(
              gameState,
              gameData,
              graph,
              {
                allowUnownedLocations: true,
                // allow passing over unowned
                logForLocations: ["calais", "paris", "chartres"]
                /*  logMethod: (...args: any[]) => {
                  sendMessage(self, {
                    data: args.filter((a) => a instanceof Object),
                    message: args.join(" "),
                    level: "log",
                    task: e.data,
                  });
                }, */
              }
            )
          };
          sendMessage(self, {
            data: resultPayload,
            message: "Proximity computation completed",
            level: "result",
            task: e.data
          });
        } catch (err) {
          sendMessage(self, {
            message: `Error during proximity computation: ${err.message}`,
            level: "error",
            task: e.data
          });
        }
        break;
      case "computeNeighbors":
        try {
          if (!gameData || !graph) {
            throw new Error("Graph Worker not initialized.");
          }
          const taskPayload = e.data.payload;
          const { gameState, locationName } = taskPayload;
          const neighborEval = {
            locationName,
            neighbors: ProximityComputationHelper.getGameStateLocationNeighborsProximity(
              locationName,
              gameState,
              gameData,
              graph,
              {
                allowUnownedLocations: true,
                // allow passing over unowned
                logForLocations: ["calais"]
                /* logMethod: (...args: any[]) => {
                  sendMessage(self, {
                    data: null,
                    message: args.join(" "),
                    level: "log",
                    task: e.data,
                  });
                }, */
              }
            )
          };
          sendMessage(self, {
            data: neighborEval,
            message: "Neighbors computation completed",
            level: "result",
            task: e.data
          });
        } catch (err) {
          sendMessage(self, {
            message: `Error during neighbors computation: ${err.message}`,
            level: "error",
            task: e.data
          });
        }
        break;
    }
  };
})();
