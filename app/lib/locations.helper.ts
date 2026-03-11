import { RoadsHelper } from "@/app/lib/roads.helper";
import { ObjectHelper } from "@/app/lib/object.helper";
import { GameData, LocationIdentifier } from "./types/general";
import {
  ILocationGameData,
  LocationGameDataMap,
} from "@/app/lib/types/location";
import { LocationRank } from "@/app/lib/types/locationRank";
import { IConstructibleLocation } from "@/app/lib/types/constructibleLocation";
import { GameState } from "@/app/lib/types/gameState";
import { ITemporaryLocationData } from "@/app/lib/types/temporaryLocationData";
import { HexColor } from "@/app/lib/types/color";
import { BaseRoadRecord, RoadRecord } from "@/app/lib/types/roads";

export class LocationsHelper {
  public static locationHasRoad(
    location: LocationIdentifier,
    baseRoads: BaseRoadRecord,
    stateRoads: RoadRecord,
  ): boolean {
    const resolved = RoadsHelper.getRoads(baseRoads, stateRoads);
    return ObjectHelper.getTypedEntries(resolved).some(
      ([key]) =>
        key.split("-")[0] === location || key.split("-")[1] === location,
    );
  }

  public static getLocationHarborSuitability(
    locationData: ILocationGameData,
    locationConstructibleData: IConstructibleLocation,
  ): number {
    if (!locationData.isCoastal) {
      return -1;
    }
    return (
      locationData.naturalHarborSuitability +
      (Object.values(locationConstructibleData?.buildings ?? {}).reduce(
        (acc, building) =>
          acc + (building?.template?.modifiers?.harborSuitability ?? 0),
        0,
      ) ?? 0)
    );
  }

  private static getDefaultMaritimePresence(
    locationData: ILocationGameData,
  ): number {
    if (locationData.topography === "ocean") {
      return 0;
    }
    if (locationData.isLake) {
      return 100;
    }
    return 50;
  }

  public static getLocationMaritimePresence(
    locationData: NonNullable<ILocationGameData>,
    locationTemporaryData: ITemporaryLocationData | null,
  ): number {
    if (!locationData.isSea && !locationData.isLake) {
      return -1;
    }
    const defaultMaritimePresence =
      this.getDefaultMaritimePresence(locationData);
    return locationTemporaryData?.maritimePresence ?? defaultMaritimePresence;
  }

  public static getLocationPopulation(
    locationIdentifier: LocationIdentifier,
    locationDataMap: LocationGameDataMap,
    gameState: GameState,
  ): number {
    if (!(locationIdentifier in locationDataMap)) {
      return 0;
    }
    const locationData = locationDataMap[locationIdentifier];
    const temporaryData =
      gameState.temporaryLocationData[locationIdentifier] ?? null;
    return temporaryData?.population ?? locationData.population;
  }

  public static getLocationDevelopment(
    locationIdentifier: LocationIdentifier,
    locationDataMap: LocationGameDataMap,
    gameState: GameState,
  ): number {
    if (!(locationIdentifier in locationDataMap)) {
      return 0;
    }
    const locationData = locationDataMap[locationIdentifier];
    const temporaryData =
      gameState.temporaryLocationData[locationIdentifier] ?? null;
    return temporaryData?.development ?? locationData.development;
  }

  public static getLocationRank(str: string): LocationRank {
    switch (str) {
      case "rural":
        return "rural";
      case "town":
        return "town";
      case "city":
        return "city";
      default:
        throw new Error(`Invalid location rank: ${str}`);
    }
  }

  public static findLocationName(
    hexColor: HexColor,
    gameData: GameData,
  ): string | null {
    if (!gameData) {
      return null;
    }
    const name = gameData?.colorToNameMap[hexColor];
    if (!name) {
      console.log("could not find name for color", hexColor);
      return null;
    }
    return name;
  }

  public static isLocationEligibleForCapital(
    location: ILocationGameData,
  ): boolean {
    return !!location.ownable && !location.isSea && !location.isLake;
  }

  public static isLocationEligibleForRoad(
    location: ILocationGameData,
  ): boolean {
    return !!location.ownable && !location.isSea && !location.isLake;
  }

  public static isLocationEligibleForMaritime(
    location: ILocationGameData,
  ): boolean {
    return !!location && (!!location.isSea || !!location.isLake);
  }
}
