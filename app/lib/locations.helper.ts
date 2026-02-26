import { RoadsHelper } from "@/app/lib/roads.helper";
import { ObjectHelper } from "@/app/lib/object.helper";
import {
  BaseRoadRecord,
  IConstructibleLocation,
  IGameState,
  ILocationDataMap,
  ILocationGameData,
  ILocationIdentifier,
  ITemporaryLocationData,
  RoadRecord,
} from "./types/general";

export class LocationsHelper {
  public static locationHasRoad(
    location: ILocationIdentifier,
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
    return locationData.naturalHarborSuitability +
      (Object.values(locationConstructibleData?.buildings ?? {}).reduce((acc, building) => acc + (building?.template?.modifiers?.harborSuitability ?? 0), 0) ?? 0);
  }


  private static getDefaultMaritimePresence(locationData: ILocationGameData): number {
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
    const defaultMaritimePresence = this.getDefaultMaritimePresence(locationData);
    return locationTemporaryData?.maritimePresence ?? defaultMaritimePresence;
  }

  public static getLocationPopulation(locationIdentifier: ILocationIdentifier, locationDataMap: ILocationDataMap, gameState: IGameState): number {
    if (!(locationIdentifier in locationDataMap)) {
      return 0;
    }
    const locationData = locationDataMap[locationIdentifier];
    const temporaryData = gameState.temporaryLocationData[locationIdentifier] ?? null;
    return temporaryData?.population ?? locationData.population;
  }

  public static getLocationDevelopment(locationIdentifier: ILocationIdentifier, locationDataMap: ILocationDataMap, gameState: IGameState): number {
    if (!(locationIdentifier in locationDataMap)) {
      return 0;
    }
    const locationData = locationDataMap[locationIdentifier];
    const temporaryData = gameState.temporaryLocationData[locationIdentifier] ?? null;
    return temporaryData?.development ?? locationData.development;
  }


}
