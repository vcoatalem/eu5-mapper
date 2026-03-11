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

interface IColorSearchResult {
  result: Record<
    LocationIdentifier,
    {
      coordinates: Array<Coordinate>;
      status: "pending" | "completed" | "error";
    }
  >;
}

export class ColorSearchController extends Observable<IColorSearchResult> {
  private mapConfig: typeof worldMapConfig = worldMapConfig;
  private gameData: GameData | null = null;
  private queriedLocationsColor: Set<LocationIdentifier> = new Set();
  private unsubscribeWorkerManager: (() => void) | null = null;

  constructor() {
    super();
    this.subject = { result: {} };
  }

  public init(mapConfig: typeof worldMapConfig, gameData: GameData): void {
    this.unsubscribeWorkerManager?.();
    this.unsubscribeWorkerManager = null;

    this.mapConfig = mapConfig;
    this.gameData = gameData;

    this.unsubscribeWorkerManager = workerManager.subscribe(
      ({ lastCompletedTask }) => {
        if (!lastCompletedTask) {
          return;
        }
        if (lastCompletedTask.type === "colorSearch") {
          const data = ZodWorkerTaskColorSearchResult.parse(
            lastCompletedTask.data,
          );
          for (const [locationName, coordinates] of Object.entries(
            data.result,
          )) {
            this.subject.result[locationName] = {
              coordinates: coordinates,
              status: "completed",
            };
          }
          this.notifyListeners();
        }
      },
    );
  }

  public requestColorSearch(missingLocations: LocationIdentifier[]): void {
    if (!this.gameData) {
      return;
    }

    const notYetQueried = missingLocations.filter(
      (loc) => !this.queriedLocationsColor.has(loc),
    );
    if (notYetQueried.length === 0) {
      return;
    }

    for (const missingLocation of notYetQueried) {
      this.subject.result[missingLocation] = {
        coordinates: [],
        status: "pending",
      };
    }
    this.notifyListeners();

    const taskId = `colorSearch-${Date.now()}`;
    const taskPayload: IWorkerTaskColorSearchPayload = {
      canvasWidth: this.mapConfig.width,
      canvasHeight: this.mapConfig.height,
      coordinates: ArrayHelper.reduceToRecord(
        notYetQueried,
        (loc) => loc,
        (loc) => {
          const locData = this.gameData?.locationDataMap[loc];
          if (!locData) {
            throw new Error(`Location data not found for location: ${loc}`);
          }
          return locData?.secondaryCoordinates?.length
            ? locData.secondaryCoordinates
            : [locData.centerCoordinates];
        },
      ),
    };
    for (const missingLocation of notYetQueried) {
      this.queriedLocationsColor.add(missingLocation);
    }
    workerManager.queueTask({
      id: taskId,
      type: "colorSearch",
      payload: taskPayload,
    });
  }
}

export const colorSearchController = new ColorSearchController();
