import { worldMapConfig } from "@/app/components/worldMap.config";
import { Observable } from "@/app/lib/observable";
import { ICoordinate, IGameData, ILocationIdentifier } from "@/app/lib/types/general";
import { workerManager } from "@/app/lib/workerManager";
import { IWorkerTaskColorSearchPayload, IWorkerTaskColorSearchResult } from "@/workers/types/workerTypes";


interface IColorSearchResult {
  result: Record<ILocationIdentifier, { coordinates: Array<ICoordinate>, status: "pending" | "completed" | "error"}>;
}

export class ColorSearchController extends Observable<IColorSearchResult> {

  private mapConfig: typeof worldMapConfig = worldMapConfig;
  private gameData: IGameData | null = null;
  private queriedLocationsColor: Set<ILocationIdentifier> = new Set();
  private unsubscribeWorkerManager: (() => void) | null = null;

  constructor() {
    super();
    this.subject = { result: {} };
  }

  public init(mapConfig: typeof worldMapConfig, gameData: IGameData): void {
    this.unsubscribeWorkerManager?.();
    this.unsubscribeWorkerManager = null;

    this.mapConfig = mapConfig;
    this.gameData = gameData;

    this.unsubscribeWorkerManager = workerManager.subscribe(({ lastCompletedTask }) => {
      if (!lastCompletedTask) {
        return;
      }
      if (lastCompletedTask.type === "colorSearch") {
        const data = lastCompletedTask.data as IWorkerTaskColorSearchResult;
        for (const [locationName, coordinates] of Object.entries(data.result)) {
          this.subject.result[locationName] = { coordinates: coordinates, status: "completed" };
        }
        this.notifyListeners();
      }
    });
  }

  public requestColorSearch(missingLocations: ILocationIdentifier[]): void {
    /*  console.log(
      "[ColorSearchController] requestColorSearch",
      missingLocations,
      this.queriedLocationsColor.entries(),
    ); */
    const notYetQueried = missingLocations.filter(
      (loc) => !this.queriedLocationsColor.has(loc),
    );
    if (notYetQueried.length === 0) {
      return;
    }

    for (const missingLocation of notYetQueried) {
      this.subject.result[missingLocation] = { coordinates: [], status: "pending" };
    }
    this.notifyListeners();

    const taskId = `colorSearch-${Date.now()}`;
    const taskPayload: IWorkerTaskColorSearchPayload = {
      canvasWidth: this.mapConfig.width,
      canvasHeight: this.mapConfig.height,
      startCoordinates: notYetQueried.reduce(
        (acc, loc) => {
          const locData = this.gameData?.locationDataMap[loc];
          if (locData?.centerCoordinates) {
            acc[loc] = locData.centerCoordinates;
          }
          return acc;
        },
        {} as Record<ILocationIdentifier, ICoordinate>,
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