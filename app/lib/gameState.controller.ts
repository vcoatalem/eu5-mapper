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
import {
  ConstructibleAction,
  IBuildingInstance,
  INewBuildingTemplate,
} from "@/app/lib/types/building";

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
      const baseLocationRank = locationData?.rank;
      const baseBuildings =
        this.gameData?.locationDataMap[location].buildings ?? [];
      const initialLocationBuildings = baseBuildings.reduce(
        (acc, buildingName) => {
          const newSet = { ...acc };
          newSet[buildingName] = {
            template: this.gameData!.buildingsTemplate[buildingName],
            level: 1,
          };
          return newSet;
        },
        {} as Record<INewBuildingTemplate["name"], IBuildingInstance>,
      );
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
    if (!this.gameData) {
      throw new Error("Game data is not initialized");
    }
    const location = this.subject.ownedLocations[locationName];
    if (!location) {
      throw new Error(
        `Cannot change rank of unowned location: ${locationName}`,
      );
    }
    location.rank = newRank;

    const eligibleBuildings = ConstructibleHelper.getEligibleBuildingTemplates(
      locationName,
      this.gameData!,
      this.subject,
    );

    const buildingsToRemove = new Set(
      Object.entries(location.buildings)
        .filter(([buildingName, buildingInstance]) => {
          if (buildingName in eligibleBuildings) {
            return true;
          }
          return buildingInstance.template.buildable; // for now, we don't want to allow destroy un buildable buildings (usually special buildings) as we don't handle their buildability yet)
        })
        .map(([name]) => name),
    );

    this.removeAllBuildingsFromLocation(locationName, buildingsToRemove);
    this.notifyListeners();
  }

  public handleBuildingAction(
    location: ILocationIdentifier,
    action: ConstructibleAction,
  ): void {
    console.log("[GameStateController] handling building action", location, action);
    switch (action.type) {
      case "build":
        const locationConstructibleData = this.subject.ownedLocations[location];
        if (!locationConstructibleData) {
          throw new Error(
            `Cannot perform constructible action on unowned location: ${location}`,
          );
        }
        if (action.building in locationConstructibleData.buildings) {
          locationConstructibleData.buildings[action.building].level += 1;
        } else {
          locationConstructibleData.buildings[action.building] = {
            template: this.gameData!.buildingsTemplate[action.building],
            level: 1,
          };
        }
        break;
      case "upgrade":
        delete this.subject.ownedLocations[location].buildings[action.building];
        this.subject.ownedLocations[location].buildings[action.to.name] = {
          template: action.to,
          level: 1,
        };
        break;
      case "downgrade":
        delete this.subject.ownedLocations[location].buildings[action.building];
        this.subject.ownedLocations[location].buildings[action.to.name] = {
          template: action.to,
          level: 1,
        };
        break;
      case "demolish":
        if (
          this.subject.ownedLocations[location].buildings[action.building]
            .level > 1
        ) {
          this.subject.ownedLocations[location].buildings[
            action.building
          ].level -= 1;
        } else {
          delete this.subject.ownedLocations[location].buildings[
            action.building
          ];
        }
        break;
      default:
        throw new Error(`Unknown constructible action ${action}`);
    }
    this.notifyListeners();
  }

  public removeAllBuildingsFromLocation(
    locationName: string,
    buildings: Set<string>,
  ): void {
    const location = this.subject.ownedLocations[locationName];
    if (!location) {
      throw new Error(
        `Cannot remove building from unowned location: ${locationName}`,
      );
    }
    for (const buildingName of buildings) {
      delete this.subject.ownedLocations[locationName].buildings[buildingName];
    }
    this.notifyListeners();
  }

  public reset(countryCode?: string): void {
    this.subject = {
      countryCode: null,
      country: baseCountryValues,
      roads: this.gameData?.roads || {},
      ownedLocations: {},
      temporaryLocationData: {},
    };
    if (!this.gameData) {
      throw new Error("Game data is not initialized");
    }
    if (countryCode) {
      const countryTemplate = this.gameData?.countriesDataMap[countryCode];
      if (!countryTemplate) {
        throw new Error(`Unknown country code: ${countryCode}`);
      }
      const capitalLocation = CountriesHelper.getCountryBaseCapitalLocation(
        countryCode,
        this.gameData.countriesDataMap,
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
