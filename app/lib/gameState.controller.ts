"use client";

import { CountriesHelper } from "@/app/lib/countries.helper";
import { cameraController } from "./cameraController";
import { ConstructibleHelper } from "./constructible.helper";
import { Observable } from "./observable";
import {
  IConstructibleLocation,
  ICountryValues,
  IGameData,
  IGameState,
  ILocationIdentifier,
  ITemporaryLocationData,
  RoadType,
} from "./types/general";

const baseCountryValues: IGameState["country"] = {
  templateData: null,
  values: {
    centralizationVsDecentralization: 0,
    landVsNaval: 0,
  },
  rulerAdministrativeAbility: 50,
};

export class GameStateController extends Observable<IGameState> {
  private gameData: IGameData | null = null;

  constructor() {
    super();
    this.subject = {} as IGameState;
  }

  public init(gameData: IGameData): void {
    this.gameData = gameData;
    this.subject = {
      countryCode: null,
      country: baseCountryValues,
      roads: gameData.roads,
      ownedLocations: {},
      temporaryLocationData: {},
    };
    this.notifyListeners();
  }

  // todo: methods like the one below that do not update subject should be service / helper methods instead
  public findLocationName(hexColor: string): string {
    const name = this.gameData?.colorToNameMap[hexColor];
    if (!name) {
      console.log("could not find name for color", hexColor);
      return "??";
    }
    return name ?? "??";
  }

  public selectLocation(locationName: string): boolean {
    if (!this.subject) return false;
    const storedLocation = this.subject.ownedLocations[locationName];
    if (!storedLocation) {
      this.acquireLocations([locationName]);
    } else {
      this.abandonLocation(locationName);
    }
    return !storedLocation;
  }

  public acquireLocations(
    locationNames: ILocationIdentifier[],
    notify: boolean = true,
  ): void {
    const toAdd: Record<ILocationIdentifier, IConstructibleLocation> = {};
    for (const location of locationNames) {
      const locationData = this.gameData?.locationDataMap[location];
      if (!locationData?.ownable) {
        continue;
      }
      const baseLocationRank = this.gameData?.locationDataMap[location].rank;
      const baseBuildings =
        this.gameData?.locationDataMap[location].buildings ?? [];
      const initialLocationBuildings = baseBuildings.map((buildingName) => {
        const buildingTemplate = this.gameData?.buildingsTemplate[buildingName];
        if (!buildingTemplate) {
          throw new Error(
            `Unknown building template: ${buildingName} for location: ${location}`,
          );
        }
        return {
          template: buildingTemplate,
          level: 1,
          createdByUser: false,
        };
      });
      const newLocation: IConstructibleLocation = {
        rank: baseLocationRank ?? "rural",
        buildings: initialLocationBuildings,
      };
      toAdd[location] = newLocation;
    }

    for (const [location, constructible] of Object.entries(toAdd)) {
      this.subject.ownedLocations[location] = constructible;
    }
    if (!this.subject.capitalLocation) {
      this.subject.capitalLocation = locationNames[0];
    }
    if (notify) {
      console.log("[GameStateController] will notify listeners...");
      this.notifyListeners();
    }
  }

  public abandonLocation(locationName: string): void {
    delete this.subject.ownedLocations[locationName];
    if (this.subject.capitalLocation === locationName) {
      this.subject.capitalLocation =
        Object.keys(this.subject.ownedLocations)?.[0] ?? null;
    }
    this.notifyListeners();
  }

  public changeCapital(locationName: string): void {
    if (!this.subject.ownedLocations[locationName]) {
      throw new Error(
        `Cannot set capital to unowned location: ${locationName}`,
      );
    }
    this.subject.capitalLocation = locationName;
    this.notifyListeners();
  }

  public changeLocationRank(
    locationName: string,
    newRank: IConstructibleLocation["rank"],
  ): void {
    const location = this.subject.ownedLocations[locationName];
    if (!location) {
      throw new Error(
        `Cannot change rank of unowned location: ${locationName}`,
      );
    }
    location.rank = newRank;

    const buildingToKeep: string[] = [];
    for (const building of location.buildings) {
      const { reason } = ConstructibleHelper.getBuildability(
        building.template,
        locationName,
        this.gameData!,
        this.subject.ownedLocations,
        this.gameData!.roads,
      );
      if (reason !== "restriction") {
        buildingToKeep.push(building.template.name);
      }
    }
    this.subject.ownedLocations[locationName].buildings =
      location.buildings.filter((b) =>
        buildingToKeep.includes(b.template.name),
      );
    this.notifyListeners();
  }

  public addBuildingToLocation(
    locationName: string,
    buildingName: string,
  ): void {
    {
      const location = this.subject.ownedLocations[locationName];
      if (!location) {
        throw new Error(
          `Cannot add building to unowned location: ${locationName}`,
        );
      }
      const buildingTemplate = this.gameData?.buildingsTemplate[buildingName];
      if (!buildingTemplate) {
        throw new Error(`Unknown building template: ${buildingName}`);
      }

      const { canBuild, reason } = ConstructibleHelper.getBuildability(
        buildingTemplate,
        locationName,
        this.gameData!,
        this.subject.ownedLocations,
        this.gameData!.roads,
      );

      if (!canBuild) {
        throw new Error(
          `Cannot build ${buildingName} at location: ${locationName} (${reason})`,
        );
      }

      const existingBuilding = location.buildings.filter(
        (b) => b.template.name === buildingName,
      )?.[0];
      const existingBuildingIdx = existingBuilding
        ? location.buildings.indexOf(existingBuilding)
        : -1;

      if (existingBuildingIdx !== -1) {
        if (existingBuilding.template.upgrade) {
          const buildingUpgrade = existingBuilding.template.upgrade;
          this.subject.ownedLocations[locationName].buildings[
            existingBuildingIdx
          ] = {
            template: this.gameData!.buildingsTemplate[buildingUpgrade],
            level: 1,
          };
        } else {
          this.subject.ownedLocations[locationName].buildings[
            existingBuildingIdx
          ].level += 1;
        }
      } else {
        const buildingToCreate = {
          template: buildingTemplate,
          level: 1,
          createdByUser: true,
        };
        this.subject.ownedLocations[locationName].buildings.push(
          buildingToCreate,
        );
      }
      this.notifyListeners();
    }
  }

  public removeBuildingFromLocation(
    locationName: string,
    buildingName: string,
  ): void {
    const location = this.subject.ownedLocations[locationName];
    const building = location.buildings.find(
      (b) => b.template.name === buildingName,
    );
    if (!building) {
      throw new Error(
        `Cannot remove non-existing building ${buildingName} at location: ${locationName}`,
      );
    }
    const buildingIdx = location.buildings.indexOf(building);
    if (building.level > 1) {
      this.subject.ownedLocations[locationName].buildings[buildingIdx].level -=
        1;
      this.notifyListeners();
    } else if (building.level === 1 && building.template.downgrade) {
      this.subject.ownedLocations[locationName].buildings[buildingIdx] = {
        template: this.gameData!.buildingsTemplate[building.template.downgrade],
        level: 1,
      };
      this.notifyListeners();
    } else {
      this.subject.ownedLocations[locationName].buildings.splice(
        buildingIdx,
        1,
      );
      this.notifyListeners();
    }
  }

  public reset(countryCode?: string): void {
    this.subject = {
      countryCode: null,
      country: baseCountryValues,
      roads: this.gameData?.roads || {},
      ownedLocations: {},
      temporaryLocationData: {},
    };
    if (countryCode) {
      const countryTemplate = this.gameData?.countriesDataMap[countryCode];
      if (!countryTemplate) {
        throw new Error(`Unknown country code: ${countryCode}`);
      }
      const capitalLocation = CountriesHelper.getCountryBaseCapitalLocation(
        countryCode,
        this.gameData?.countriesDataMap!,
      );
      this.subject.capitalLocation = capitalLocation;
      const locationsToAcquire = countryTemplate.locations;
      if (locationsToAcquire) {
        this.acquireLocations(locationsToAcquire, false);
        this.subject.countryCode = countryCode;
        this.subject.country = {
          templateData: countryTemplate,
          values: {
            centralizationVsDecentralization:
              countryTemplate.centralizationVsDecentralization,
            landVsNaval: countryTemplate.landVsNaval,
          },
          rulerAdministrativeAbility: 50,
        };
      }

      const capitalCoordinates =
        this.gameData?.locationDataMap[capitalLocation].centerCoordinates;
      if (capitalCoordinates) {
        cameraController.panToCoordinate(capitalCoordinates, 0); // TODO: do this in a subscription to gameState instead
      }
    }

    this.notifyListeners();
  }

  public changeCountryValues(value: Partial<ICountryValues>): void {
    if (!this.subject.country?.values) {
      return;
    }
    if (
      typeof value.centralizationVsDecentralization === "number" &&
      value.centralizationVsDecentralization <= 100 &&
      value.centralizationVsDecentralization >= -100
    ) {
      this.subject.country.values.centralizationVsDecentralization =
        value.centralizationVsDecentralization;
    }

    if (
      typeof value.landVsNaval === "number" &&
      value.landVsNaval <= 100 &&
      value.landVsNaval >= -100
    ) {
      this.subject.country.values.landVsNaval = value.landVsNaval;
    }
    this.notifyListeners();
  }

  public changeCountryRulerAdministrativeAbility(value: number): void {
    if (!this.subject.country) {
      return;
    }
    this.subject.country.rulerAdministrativeAbility = value;
    this.notifyListeners();
  }

  public changeRoadType(key: string, type: RoadType | null): void {
    const roadsCopy: IGameState["roads"] = {};
    for (const loc of Object.keys(this.subject.roads)) {
      roadsCopy[loc] = [...this.subject.roads[loc]];
    }
    ConstructibleHelper.applyRoadTypeChange(roadsCopy, key, type);
    this.subject.roads = roadsCopy;
    this.notifyListeners();
  }

  public changeRoadTypeBulk(
    changes: Array<{ key: string; type: RoadType | null }>,
  ): void {
    const roads: IGameState["roads"] = {};
    for (const loc of Object.keys(this.subject.roads)) {
      roads[loc] = [...this.subject.roads[loc]];
    }
    for (const { key, type } of changes) {
      ConstructibleHelper.applyRoadTypeChange(roads, key, type);
    }
    this.subject.roads = roads;
    this.notifyListeners();
  }

  public changeAllOwnedRoadsToType(type: RoadType): void {
    const roads = ConstructibleHelper.getOwnedRoads(
      this.subject.ownedLocations,
      this.subject.roads,
    );
    this.changeRoadTypeBulk(
      Object.entries(roads).map(([key]) => ({ key, type })),
    );
  }

  public changeTemporaryLocationData(
    location: ILocationIdentifier,
    data: Partial<ITemporaryLocationData>,
  ): void {
    let existingData = this.subject.temporaryLocationData[location];
    if (!existingData) {
      this.subject.temporaryLocationData[location] = {};
      existingData = this.subject.temporaryLocationData[location];
    }

    this.subject.temporaryLocationData[location] = {
      ...existingData,
      ...data,
    };
    this.notifyListeners();
  }

  public resetTemporaryLocationData(
    location: ILocationIdentifier,
    key: keyof ITemporaryLocationData,
  ): void {
    if (this.subject.temporaryLocationData[location]) {
      delete this.subject.temporaryLocationData[location][key];
      if (
        Object.keys(this.subject.temporaryLocationData[location]).length === 0
      ) {
        delete this.subject.temporaryLocationData[location];
      }
      this.notifyListeners();
    }
  }

  public loadFile(fileContent: string, expectedVersion: string): void {
    const parsedState = JSON.parse(fileContent) as IGameState & {
      version: string;
    };
    if (
      !parsedState ||
      typeof parsedState !== "object" ||
      !parsedState.version
    ) {
      throw new Error("Invalid file format: missing version");
    }
    if (parsedState.version !== expectedVersion) {
      throw new Error(
        'File version is of version "' +
          parsedState.version +
          '", but expected version is "' +
          expectedVersion +
          '". Version migration is not supported yet, but you can try migrating the file manually.',
      );
    }
    this.subject = parsedState;
    this.notifyListeners();
    const capitalCoordinates =
      this.gameData?.locationDataMap[this.subject.capitalLocation ?? ""]
        ?.centerCoordinates;
    if (capitalCoordinates) {
      cameraController.panToCoordinate(capitalCoordinates, 0);
    }
  }

  public download(version: string): void {
    const filename = `${this.subject.countryCode ?? "unknown_country"}-${version.replaceAll(".", "_")}-${new Date().toISOString()}.json`;
    const fileContent = JSON.stringify({ version, ...this.subject });
    const blob = new Blob([fileContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
export const gameStateController = new GameStateController();

export const debouncedGameStateController = gameStateController.debounce(50);
