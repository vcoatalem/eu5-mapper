import { worldMapConfig } from "@/app/components/worldMap.config";
import { ArrayHelper } from "@/app/lib/array.helper";
import { Observable } from "@/app/lib/observable";
import { Coordinate } from "@/app/lib/types/coordinate";
import { GameData, LocationIdentifier } from "@/app/lib/types/general";
import { workerManager } from "@/app/lib/workerManager";
import {
  IWorkerTaskColorSearchPayload,
  ZodWorkerTaskColorSearchResult,
} from "@/workers/types/colorSearch";

export interface IColorSearchDelta {
  completedLocations: Array<{ loc: LocationIdentifier; coords: Coordinate[] }>;
}

export class ColorSearchModel extends Observable<IColorSearchDelta> {
  private mapConfig: typeof worldMapConfig = worldMapConfig;
  private gameData: GameData | null = null;
  private queriedLocationsColor: Set<LocationIdentifier> = new Set();
  private unsubscribeWorkerManager: (() => void) | null = null;

  constructor() {
    super();
    this.subject = { completedLocations: [] };
  }

  public init(mapConfig: typeof worldMapConfig, gameData: GameData): void {
    this.unsubscribeWorkerManager?.();
    this.unsubscribeWorkerManager = null;
    this.mapConfig = mapConfig;
    this.gameData = gameData;
    this.queriedLocationsColor.clear();

    this.unsubscribeWorkerManager = workerManager.subscribe(
      ({ lastCompletedTask }) => {
        if (!lastCompletedTask || lastCompletedTask.type !== "colorSearch")
          return;
        const data = ZodWorkerTaskColorSearchResult.parse(
          lastCompletedTask.data,
        );
        this.subject = {
          completedLocations: Object.entries(data.result).map(
            ([loc, coords]) => ({ loc, coords }),
          ),
        };
        this.notifyListeners();
      },
    );
  }

  public requestColorSearch(missingLocations: LocationIdentifier[]): void {
    if (!this.gameData) return;
    const notYetQueried = missingLocations.filter(
      (loc) => !this.queriedLocationsColor.has(loc),
    );
    if (notYetQueried.length === 0) return;
    for (const loc of notYetQueried) this.queriedLocationsColor.add(loc);

    const taskPayload: IWorkerTaskColorSearchPayload = {
      canvasWidth: this.mapConfig.width,
      canvasHeight: this.mapConfig.height,
      coordinates: ArrayHelper.reduceToRecord(
        notYetQueried,
        (loc) => loc,
        (loc) => {
          const locData = this.gameData?.locationDataMap[loc];
          if (!locData)
            throw new Error(`Location data not found for location: ${loc}`);
          return locData.secondaryCoordinates?.length
            ? locData.secondaryCoordinates
            : [locData.centerCoordinates];
        },
      ),
    };
    workerManager.queueTask({
      id: `colorSearch-${Date.now()}`,
      type: "colorSearch",
      payload: taskPayload,
    });
  }
}
