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
    addEdge(a, b, edgeType, throughSeaLocation) {
      const aId = this._getNodeId(a);
      const bId = this._getNodeId(b);
      if (!(aId in this.adjacency)) {
        this.adjacency[aId] = [];
      }
      if (!(bId in this.adjacency)) {
        this.adjacency[bId] = [];
      }
      const edgeAB = {
        neighbor: bId,
        edgeType
      };
      const edgeBA = {
        neighbor: aId,
        edgeType
      };
      if (throughSeaLocation !== void 0) {
        edgeAB.throughSeaLocation = throughSeaLocation;
        edgeBA.throughSeaLocation = throughSeaLocation;
      }
      this.adjacency[aId].push(edgeAB);
      this.adjacency[bId].push(edgeBA);
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
      const neighbors = this.adjacency[aId];
      if (!neighbors) {
        return {
          exists: false,
          type: "unknown"
        };
      }
      const edge = neighbors.find((n) => n.neighbor === bId);
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
        const edges = this.adjacency[node] ?? [];
        for (const { neighbor, edgeType, throughSeaLocation } of edges) {
          const neighborStr = this._getNodeString(neighbor);
          const edgeCost = getCost(
            nodeStr,
            neighborStr,
            edgeType,
            throughSeaLocation
          );
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
     * Finds the shortest path from startNode to endNode and returns the path as an array of edges.
     * Each edge contains { from, to, edgeType, cost }.
     * Returns null if no path exists within the cost limit.
     */
    getShortestPath(startNode, endNode, costLimit, getCost) {
      const startId = this.nodeToId[startNode];
      const endId = this.nodeToId[endNode];
      if (startId === void 0 || endId === void 0)
        return null;
      if (startId === endId)
        return [];
      const distances = {};
      const predecessors = {};
      const pq = [
        { node: startId, cost: 0 }
      ];
      distances[startId] = 0;
      predecessors[startId] = null;
      while (pq.length > 0) {
        pq.sort((a, b) => a.cost - b.cost);
        const current = pq.shift();
        const { node, cost } = current;
        if (node === endId) {
          const path = [];
          let currentNode = endId;
          while (predecessors[currentNode] !== null) {
            const pred = predecessors[currentNode];
            const fromStr = this._getNodeString(pred.node);
            const toStr = this._getNodeString(currentNode);
            const edgeCost = getCost(fromStr, toStr, pred.edgeType);
            path.unshift({
              from: fromStr,
              to: toStr,
              edgeType: pred.edgeType,
              cost: edgeCost.cost
            });
            currentNode = pred.node;
          }
          return path;
        }
        if (cost > costLimit)
          continue;
        if (cost > distances[node])
          continue;
        const nodeStr = this._getNodeString(node);
        const edges = this.adjacency[node] ?? [];
        for (const { neighbor, edgeType, throughSeaLocation } of edges) {
          const neighborStr = this._getNodeString(neighbor);
          const edgeCost = getCost(
            nodeStr,
            neighborStr,
            edgeType,
            throughSeaLocation
          );
          const newCost = cost + edgeCost.cost;
          if (newCost <= costLimit && (!(neighbor in distances) || newCost < distances[neighbor])) {
            distances[neighbor] = newCost;
            predecessors[neighbor] = { node, edgeType };
            pq.push({ node: neighbor, cost: newCost });
          }
        }
      }
      return null;
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
        const edges = this.adjacency[node] ?? [];
        for (const { neighbor, edgeType, throughSeaLocation } of edges) {
          if (visited.has(neighbor))
            continue;
          const neighborStr = this._getNodeString(neighbor);
          const nodeStr = this._getNodeString(node);
          const edgeCost = getCost(
            nodeStr,
            neighborStr,
            edgeType,
            throughSeaLocation
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
      let throughSeaEdges = 0;
      let coastalEdges = 0;
      for (const key in this.adjacency) {
        const neighbors = this.adjacency[key];
        totalEdges += neighbors.length;
        riverEdges += neighbors.filter((n) => n.edgeType === "river").length;
        landEdges += neighbors.filter((n) => n.edgeType === "land").length;
        seaEdges += neighbors.filter((n) => n.edgeType === "sea").length;
        portEdges += neighbors.filter((n) => n.edgeType === "port").length;
        lakeEdges += neighbors.filter((n) => n.edgeType === "lake").length;
        coastalEdges += neighbors.filter((n) => n.edgeType === "coastal").length;
        portRiverEdges += neighbors.filter(
          (n) => n.edgeType === "port-river"
        ).length;
        throughSeaEdges += neighbors.filter(
          (n) => n.edgeType === "through-sea"
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
        portRiverEdges,
        coastalEdges,
        throughSeaEdges,
        unknownEdges: totalEdges - riverEdges - landEdges - seaEdges - portEdges - lakeEdges - portRiverEdges - throughSeaEdges - coastalEdges
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
        const [locationA, locationB, edgeType, throughSeaLocation] = line.split(",");
        if ([
          "river",
          "land",
          "sea",
          "port",
          "lake",
          "port-river",
          "through-sea",
          "coastal"
        ].includes(edgeType) === false) {
          throw new Error(
            `Invalid edge type "${edgeType}" in adjacency CSV at line ${i + 1}`
          );
        }
        graph2.addEdge(
          locationA,
          locationB,
          edgeType,
          throughSeaLocation || void 0
        );
      }
      return graph2;
    }
    // jsonContent should be an array of [from, to] pairs
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
          type: "gravel_road",
          createdByUser: false
        });
        roadRecord[to].push({
          to: from,
          type: "gravel_road",
          createdByUser: false
        });
      }
      return roadRecord;
    }
  };

  // app/lib/classes/countryProximityBuffs.ts
  var ProximityBuffsRecord = class {
    constructor(rule, country) {
      this.rule = rule;
      this.country = country;
      this.countryProximityBuffs = {};
      const navalVsLand = this.computeCountryValuesBuff("landVsNaval");
      const centralizationVsDecentralization = this.computeCountryValuesBuff(
        "centralizationVsDecentralization"
      );
      const rulerAdministrativeAbility = {
        genericModifier: (country?.rulerAdministrativeAbility ?? 0) * rule.rulerAdministrativeAbilityImpact
      };
      this.countryProximityBuffs = {
        navalVsLand,
        centralizationVsDecentralization,
        rulerAdministrativeAbility
      };
    }
    computeCountryValuesBuff(valueKey) {
      const value = this.country?.values[valueKey];
      if (typeof value !== "number" || value === 0) {
        return {};
      }
      const buffToApply = value > 0 ? this.rule.valuesImpact[valueKey][1] : this.rule.valuesImpact[valueKey][0];
      if (!buffToApply || typeof buffToApply !== "object") {
        console.error(
          "[ProximityBuffsRecord] Invalid buff definition for",
          valueKey,
          buffToApply
        );
        return {};
      }
      const impactFactor = Math.abs(value) / 100;
      const res = {};
      const allowedKeys = [
        "genericModifier",
        "landModifier",
        "genericFlatModifier",
        "seaWithMaritimeFlatCostReduction",
        "seaWithoutMaritimeFlatCostReduction",
        "portFlatCostReduction",
        "topographyMultipliers"
      ];
      for (const key of Object.keys(buffToApply)) {
        if (!allowedKeys.includes(key)) {
          console.error(
            "[ProximityBuffsRecord] Unknown buff key for",
            valueKey,
            "key:",
            key,
            "buff:",
            buffToApply
          );
          continue;
        }
        if (key === "topographyMultipliers") {
          const source = buffToApply.topographyMultipliers;
          if (!source) {
            continue;
          }
          const topographyBuffs = {};
          for (const topographyKey of Object.keys(source)) {
            const topographyValue = source[topographyKey];
            if (typeof topographyValue === "number") {
              topographyBuffs[topographyKey] = topographyValue * impactFactor;
            }
          }
          if (Object.keys(topographyBuffs).length > 0) {
            res.topographyMultipliers = topographyBuffs;
          }
        } else {
          const numericKey = key;
          const buffToApplyValue = buffToApply[numericKey];
          if (typeof buffToApplyValue === "number") {
            res[numericKey] = buffToApplyValue * impactFactor;
          }
        }
      }
      return res;
    }
    getBuffsOfType(type, topography) {
      const buffRecord = Object.fromEntries(
        Object.entries(this.countryProximityBuffs).map(
          ([buffName, buffEffects]) => {
            const buffEffect = buffEffects[type];
            switch (typeof buffEffect) {
              case "number":
                return [buffName, buffEffect];
              case "object":
                const topographyBuff = buffEffect[topography ?? "unknown"] ?? 0;
                return [buffName, topographyBuff];
              default:
                return [buffName, 0];
            }
          }
        )
      );
      return {
        buffRecord,
        sum: Object.values(buffRecord).reduce((a, b) => a + b, 0)
      };
    }
  };

  // app/lib/proximityComputation.helper.ts
  var logProximityComputation = (location, options, message, data) => {
    if (!options.logMethod || !options.logForLocations)
      return;
    const locationsToCheck = Array.isArray(location) ? location : [location];
    const shouldLog = locationsToCheck.some(
      (loc) => options.logForLocations.includes(loc)
    );
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
          const locationBuildings = Object.values(
            gameState.ownedLocations[locationName].buildings
          );
          const highestProximitySource = Math.max(
            ...locationBuildings.map(
              (b) => b.template.modifiers.localProximitySource ?? 0
            )
          );
          if (highestProximitySource > 0) {
            proximitySourceLocations[locationName] = highestProximitySource;
          }
        }
      }
      return proximitySourceLocations;
    }
    static getFlatProximityCost(edgeType, rule, maritimePresence, roadToDestination, proximityBuffs) {
      const baseCost = edgeType.includes("river") ? rule.baseRiverCost : rule.baseCost;
      const isImpactedByRoad = edgeType === "land";
      const isNaval = edgeType === "sea" || edgeType === "lake" || !rule.throughSeaEdgeCountedAsLandProximity && edgeType === "through-sea";
      if (edgeType === "port") {
        const portFlatCostReduction = proximityBuffs.getBuffsOfType("portFlatCostReduction").sum ?? 0;
        return baseCost - portFlatCostReduction;
      }
      if (!isNaval) {
        const roadFlatCostReduction = isImpactedByRoad && roadToDestination ? rule.roadProximityCostReduction[roadToDestination] : 0;
        return baseCost - roadFlatCostReduction;
      } else {
        let normalizedMaritimePresence = edgeType === "lake" ? 1 : maritimePresence / 100;
        normalizedMaritimePresence = Math.max(
          0,
          Math.min(1, normalizedMaritimePresence)
        );
        const costWithoutMaritimePresence = rule.baseCostWithoutMaritimePresence - (proximityBuffs.getBuffsOfType("seaWithoutMaritimeFlatCostReduction").sum ?? 0);
        const costWithMaritimePresence = rule.baseCostWithMaritimePresence - (proximityBuffs.getBuffsOfType("seaWithMaritimeFlatCostReduction").sum ?? 0);
        return costWithoutMaritimePresence * (1 - normalizedMaritimePresence) + costWithMaritimePresence * normalizedMaritimePresence;
      }
    }
    static getTransportationModeProximityCostModifiers(from, to, transportationMode, gameData2, gameState, roadType, proximityBuffs, options) {
      switch (transportationMode) {
        case "land":
          if (from in gameState.ownedLocations || options.allowUnownedLocations) {
            return _ProximityComputationHelper.getLandLocationProximityModifiers(
              gameData2.locationDataMap[from],
              gameState.ownedLocations[from],
              gameState.temporaryLocationData[from] ?? null,
              gameData2,
              {
                discardVegetationModifiers: !!roadType,
                discardVegetationAndTopographyModifiers: false
              },
              proximityBuffs,
              options
            );
          } else {
            return 0;
          }
        case "harbor":
          const toLocation = gameData2.locationDataMap[to];
          const fromLocation = gameData2.locationDataMap[from];
          const locationWithHarbor = toLocation.isSea ? from : to;
          const harborCapacity = _ProximityComputationHelper.getLocationHarborCapacity(
            gameData2.locationDataMap[locationWithHarbor],
            gameState.ownedLocations[locationWithHarbor],
            options
          );
          const harborImpact = gameData2.proximityComputationRule.harborCapacityImpact;
          const harborCapacityModifier = harborCapacity * harborImpact * 100;
          if (fromLocation.isSea) {
            return harborCapacityModifier;
          } else {
            const harborLocationProximityModifiers = _ProximityComputationHelper.getLandLocationProximityModifiers(
              gameData2.locationDataMap[locationWithHarbor],
              gameState.ownedLocations[locationWithHarbor],
              gameState.temporaryLocationData[locationWithHarbor] ?? null,
              gameData2,
              {
                discardVegetationAndTopographyModifiers: true,
                discardVegetationModifiers: true
              },
              proximityBuffs,
              options
            );
            logProximityComputation(
              locationWithHarbor,
              options,
              "Summing Harbor Modifiers",
              { harborLocationProximityModifiers, harborCapacityModifier }
            );
            return harborLocationProximityModifiers + harborCapacityModifier;
          }
        case "naval":
        case "coastal":
          return 0;
      }
    }
    static getPercentageProximityCostModifiers(from, to, edgeType, gameData2, gameState, proximityBuffs, options, roadType) {
      const rule = gameData2.proximityComputationRule;
      const toLocationData = gameData2.locationDataMap[to];
      const isNaval = toLocationData.isSea || toLocationData.isLake;
      const transportationMode = edgeType === "port" || edgeType === "port-river" ? "harbor" : isNaval || !rule.throughSeaEdgeCountedAsLandProximity && edgeType === "through-sea" ? "naval" : edgeType === "coastal" ? "coastal" : "land";
      const modifiers = [
        this.getTransportationModeProximityCostModifiers(
          from,
          to,
          transportationMode,
          gameData2,
          gameState,
          roadType,
          proximityBuffs,
          options
        ),
        proximityBuffs.getBuffsOfType("genericModifier").sum ?? 0
      ];
      logProximityComputation([from, to], options, "Proximity cost modifiers", {
        from,
        to,
        isNaval,
        modifiers
      });
      return modifiers.reduce((a, b) => a + b, 0);
    }
    static getMaritimePresenceAtLocation(gameData2, location) {
      if (gameData2.locationDataMap[location].topography === "ocean") {
        return 0;
      }
      return 50;
    }
    static getProximityCostFunction(gameState, gameData2, options) {
      return (from, to, edgeType, throughSeaLocation) => {
        const rule = gameData2.proximityComputationRule;
        const road = gameState.roads[from]?.find(
          ({ to: roadTo }) => roadTo === to
        );
        const countryProximityBuffs = new ProximityBuffsRecord(
          rule,
          gameState.country
        );
        if (!rule.throughSeaEdgeCountedAsLandProximity && throughSeaLocation && edgeType === "through-sea") {
          from = throughSeaLocation;
        }
        const maritimePresence = this.getMaritimePresenceAtLocation(
          gameData2,
          from
        );
        const baseCost = this.getFlatProximityCost(
          edgeType,
          rule,
          maritimePresence,
          road?.type ?? null,
          countryProximityBuffs
        );
        logProximityComputation([from, to], options, "Base proximity cost", {
          from,
          to,
          through: { edgeType, throughSeaLocation: throughSeaLocation ?? "N/A" },
          baseCost
        });
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
          countryProximityBuffs,
          options,
          road?.type ?? null
        );
        const modifiedCost = Math.max(
          0.1,
          baseCost * (1 - proximityModifiersSummed / 100)
        );
        logProximityComputation([from, to], options, "Final proximity cost", {
          from,
          to,
          edgeType,
          modifiedCost,
          proximityModifiersSummed
        });
        return {
          cost: modifiedCost,
          through: edgeType
        };
      };
    }
    static getPathFromClosestProximitySource(target, gameState, gameData2, adjacencyGraph, pathfindingOptions) {
      const proximitySourceLocations = _ProximityComputationHelper.getLocalProximitySourceLocations(gameState);
      const shortestPaths = [];
      for (const [
        proximitySourceLocationName,
        proximitySourceAmount
      ] of Object.entries(proximitySourceLocations)) {
        const shortestPath = adjacencyGraph.getShortestPath(
          proximitySourceLocationName,
          target,
          proximitySourceAmount,
          _ProximityComputationHelper.getProximityCostFunction(
            gameState,
            gameData2,
            pathfindingOptions
          )
        );
        if (shortestPath) {
          shortestPaths.push({
            sourceLocation: proximitySourceLocationName,
            proximity: proximitySourceAmount,
            path: shortestPath
          });
        }
      }
      if (shortestPaths.length === 0) {
        return null;
      }
      shortestPaths.sort((a, b) => {
        const totalCostA = a.path.reduce((acc, step) => acc + step.cost, 0);
        const totalCostB = b.path.reduce((acc, step) => acc + step.cost, 0);
        const scoreA = a.proximity - totalCostA;
        const scoreB = b.proximity - totalCostB;
        return scoreB - scoreA;
      });
      return shortestPaths[0];
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
  _ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage = (location, gameData2, discardVegetationModifiers, options) => {
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
    const vegetationCostIncreasePercentage = location.vegetation && !discardVegetationModifiers ? rule.proximityCostIncreasePercentage.vegetation?.[location.vegetation] ?? 0 : 0;
    logProximityComputation(
      location.name,
      options,
      "Environmental proximity cost increase percentage",
      {
        topographyCostIncreasePercentage,
        vegetationCostIncreasePercentage,
        discardVegetationModifiers
      }
    );
    const totalEnvironmentalCostIncrease = topographyCostIncreasePercentage + vegetationCostIncreasePercentage;
    return totalEnvironmentalCostIncrease;
  };
  _ProximityComputationHelper.getLandLocationProximityModifiers = (location, locationConstructibleData, locationTemporaryData, gameData2, behaviour, proximityBuffs, options) => {
    if (location.isSea || location.isLake || !location.ownable) {
      return 0;
    }
    const buildings = locationConstructibleData?.buildings ?? [];
    const totalBuildingsCostReduction = Object.values(buildings).map(
      (b) => Math.abs(b.template.modifiers.localProximityCostModifier ?? 0) * 100 * // O.0.11 effects are negative floats, 0.1.0 positive - we might need to change this formula if there are buildings giving negative local prox in the future
      b.level
    ).reduce((a, b) => a + b, 0);
    const environmentalProximityCostIncreasePercentage = behaviour.discardVegetationAndTopographyModifiers ? 0 : _ProximityComputationHelper.getEnvironmentalProximityCostIncreasePercentage(
      location,
      gameData2,
      behaviour.discardVegetationModifiers,
      // road
      options
    );
    const development = locationTemporaryData?.development ?? location.development;
    const developmentCostReduction = development * gameData2.proximityComputationRule.developmentImpact;
    const landModifierFromBuffs = proximityBuffs.getBuffsOfType("landModifier");
    logProximityComputation(
      location.name,
      options,
      "Land location proximity modifiers",
      {
        totalBuildingsCostReduction,
        landModifierFromBuffs,
        developmentCostReduction,
        environmentalProximityCostIncreasePercentage
      }
    );
    const total = (
      // positive proximity (cost reduction)
      totalBuildingsCostReduction + landModifierFromBuffs.sum + developmentCostReduction - // negative proximity (cost increase)
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
    const totalBuildingsHarborCapacity = Object.values(buildings).map((b) => {
      const capacity = (b.template.modifiers.harborSuitability ?? 0) * b.level;
      return capacity || 0;
    }).reduce((a, b) => a + b, 0);
    logProximityComputation(locationData.name, options, "Harbor capacity", {
      locationConstructibleData,
      totalBuildingsHarborCapacity,
      naturalHarborSuitability
    });
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
          if (!gameState.capitalLocation) {
            sendMessage(self, {
              message: "No capital location defined for the country - skipping computation",
              level: "result",
              task: {
                id: e.data.id,
                type: e.data.type,
                payload: e.data
              },
              data: { result: {} }
            });
            return;
          }
          const proximityBuffs = new ProximityBuffsRecord(
            gameData.proximityComputationRule,
            gameState.country
          );
          const landProximityBuffs = proximityBuffs.getBuffsOfType("landModifier");
          const seaProximityBuffs = proximityBuffs.getBuffsOfType(
            "seaWithMaritimeFlatCostReduction"
          );
          sendMessage(self, {
            data: { proximityBuffs, landProximityBuffs, seaProximityBuffs },
            message: "Proximity buffs computed",
            level: "log",
            task: e.data
          });
          const resultPayload = {
            result: ProximityComputationHelper.getGameStateProximityComputation(
              gameState,
              gameData,
              graph,
              {
                allowUnownedLocations: true,
                // allow passing over unowned
                logForLocations: [
                  /* "melun" */
                ],
                logMethod: (message, data) => {
                  sendMessage(self, {
                    data: data ?? null,
                    message,
                    level: "log",
                    task: e.data
                  });
                }
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
                logForLocations: [
                  /* "strait_of_dover" */
                ],
                logMethod: (message, data) => {
                  sendMessage(self, {
                    data: data ?? null,
                    message,
                    level: "log",
                    task: e.data
                  });
                }
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
      case "computeShortestPathFromProximitySource":
        try {
          if (!gameData || !graph) {
            throw new Error("Graph Worker not initialized.");
          }
          const taskPayload = e.data.payload;
          const { gameState, targetLocationName } = taskPayload;
          const shortestPathResult = ProximityComputationHelper.getPathFromClosestProximitySource(
            targetLocationName,
            gameState,
            gameData,
            graph,
            {
              allowUnownedLocations: true,
              logMethod: (message, data) => {
                sendMessage(self, {
                  data: data ?? null,
                  message,
                  level: "log",
                  task: e.data
                });
              }
            }
          );
          const resultPayload = {
            location: targetLocationName,
            shortestPath: shortestPathResult === null ? null : {
              sourceLocation: shortestPathResult.sourceLocation,
              proximity: shortestPathResult.proximity,
              path: shortestPathResult.path
            }
          };
          sendMessage(self, {
            data: resultPayload,
            message: "Shortest path to proximity source computation completed",
            level: "result",
            task: e.data
          });
        } catch (err) {
          sendMessage(self, {
            message: `Error during shortest path to proximity source computation: ${err.message}`,
            level: "error",
            task: e.data
          });
        }
        break;
    }
  };
})();
