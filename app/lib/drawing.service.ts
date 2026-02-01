import { gameStateController } from "@/app/lib/gameState.controller";
import {
  IProximityComputationResults,
  proximityComputationController,
} from "@/app/lib/proximityComputation.controller";
import {
  IConstructibleLocation,
  ICoordinate,
  IGameData,
  IGameState,
  ILocationIdentifier,
} from "./types/general";
import { workerManager } from "./workerManager";
import { ObservableCombiner } from "./observableCombiner";
import { DrawingHelper } from "./drawing/drawing.helper";
import {
  IWorkerTaskColorSearchPayload,
  IWorkerTaskColorSearchResult,
} from "@/workers/types/workerTypes";
import {
  IZoomState,
  zoomController,
  zoomLevels,
  ZoomListener,
} from "@/app/lib/zoomController";
import {
  capitalColor,
  ColorHelper,
  defaultAreaColor,
} from "./drawing/color.helper";
import { Subject } from "./subject";

export class DrawingService {
  private areaDrawingCanvas: HTMLCanvasElement;
  private areaDrawingContext: CanvasRenderingContext2D;
  private constructibleDrawingCanvas: HTMLCanvasElement;
  private constructibleDrawingContext: CanvasRenderingContext2D;
  private roadDrawingCanvas: HTMLCanvasElement;
  private roadDrawingContext: CanvasRenderingContext2D;
  private mapInfos: { width: number; height: number };
  private coordinateMap: Record<ILocationIdentifier, Array<ICoordinate>> = {};
  private gameData: IGameData | null = null;
  private reDraw: Subject<Date> = new Subject<Date>();

  public addCoordinate(
    name: ILocationIdentifier,
    coordinates: ICoordinate[],
  ): void {
    if (!this.coordinateMap[name]) {
      this.coordinateMap[name] = coordinates;
    }
  }

  constructor(
    areaDrawingCanvas: HTMLCanvasElement,
    constructibleDrawingCanvas: HTMLCanvasElement,
    roadDrawingCanvas: HTMLCanvasElement,
    mapInfos: { width: number; height: number },
    gameData: IGameData,
  ) {
    this.areaDrawingCanvas = areaDrawingCanvas;
    this.constructibleDrawingCanvas = constructibleDrawingCanvas;
    this.roadDrawingCanvas = roadDrawingCanvas;
    this.mapInfos = mapInfos;
    this.gameData = gameData;
    const areaDrawingContext = this.areaDrawingCanvas.getContext("2d", {});
    if (!areaDrawingContext) {
      throw new Error(
        "DrawingLogicController constructor error: could not get drawing context",
      );
    }
    this.areaDrawingContext = areaDrawingContext;
    const drawingContext = this.constructibleDrawingCanvas.getContext("2d", {});
    if (!drawingContext) {
      throw new Error(
        "DrawingLogicController constructor error: could not get constructible drawing context",
      );
    }
    this.constructibleDrawingContext = drawingContext;
    const roadDrawingContext = this.roadDrawingCanvas.getContext("2d", {});
    if (!roadDrawingContext) {
      throw new Error(
        "DrawingLogicController constructor error: could not get road drawing context",
      );
    }
    this.roadDrawingContext = roadDrawingContext;
    this.drawRoads(gameStateController.getSnapshot());
    workerManager.subscribe(({ lastCompletedTask }) => {
      /*  console.log(
        "[DrawingLogicService] WorkerManager status update on lastCompletedTask",
        {
          lastCompletedTask,
        },
      ); */
      if (!lastCompletedTask) {
        return;
      }

      if (lastCompletedTask.type === "colorSearch") {
        const data = lastCompletedTask.data as IWorkerTaskColorSearchResult;
        const coordinates = data.result;
        for (const [locationName, coords] of Object.entries(coordinates)) {
          this.addCoordinate(locationName, coords);
        }
        console.log("[DrawingService] received color search results", {
          coordinates,
        });
        this.reDraw.emit(new Date());
      }
    });

    new ObservableCombiner([
      gameStateController,
      proximityComputationController,
      this.reDraw,
    ])
      .debounce(10)
      .subscribe(({ values: [gameState, proximityEvaluation] }) => {
        console.log(
          "[DrawingLogicService] game state and proximity subscription triggered",
          {
            gameState,
            proximityEvaluation,
          },
        );

        this.drawAreas(gameState, proximityEvaluation);
        this.drawRoads(gameState);
      });

    new ObservableCombiner([gameStateController, zoomController])
      .debounce(10)
      .subscribe(({ values: [gameState, zoom] }) => {
        //this.gameStateSnapshot = gameState;
        //console.log({ gameState, zoom });
        this.drawConstructibles(gameState, zoom);
      });

    this.reDraw.emit(new Date()); // this has to be after subscriptions are set up
  }

  private drawAreas(
    gameState: IGameState,
    proximityEvaluation: IProximityComputationResults,
  ): void {
    const imageData = this.areaDrawingContext.createImageData(
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const data = imageData.data;

    let missingCoordinates: ILocationIdentifier[] = [];
    for (const location of Object.keys(gameState.ownedLocations)) {
      const coordinates = this.coordinateMap[location];
      if (!coordinates) {
        missingCoordinates.push(location);
        continue;
      }
      let evaluation: number | undefined =
        proximityEvaluation.result?.[location]?.cost ?? -1;

      const color = ColorHelper.getEvaluationColor(evaluation);

      const [r, g, b] = color;

      for (const { x, y } of coordinates) {
        const index = (y * this.mapInfos.width + x) * 4;
        data[index] = r; // R
        data[index + 1] = g; // G
        data[index + 2] = b; // B
        data[index + 3] = 255; // A
      }
    }

    /*     console.log(
      "[DrawingService] missing coordinates for locations:",
      missingCoordinates,
    ); */
    if (missingCoordinates.length > 0) {
      const taskId = `colorSearch-${Date.now()}`;
      const taskPayload: IWorkerTaskColorSearchPayload & {
        type: "colorSearch";
      } = {
        type: "colorSearch", // todo: see if this is really needed
        canvasWidth: this.areaDrawingCanvas.width,
        canvasHeight: this.areaDrawingCanvas.height,
        startCoordinates: missingCoordinates.reduce(
          (acc, loc) => {
            const locData = this.gameData?.locationDataMap[loc];
            if (locData?.constructibleLocationCoordinate) {
              acc[loc] = DrawingHelper.gameCoordinatesToCanvasCoordinates(
                locData.constructibleLocationCoordinate,
                this.areaDrawingCanvas.height,
              );
            }
            return acc;
          },
          {} as Record<ILocationIdentifier, { x: number; y: number }>,
        ),
      };
      workerManager.queueTask({
        id: taskId,
        type: "colorSearch",
        payload: taskPayload,
      });
    }

    // Draw once
    this.areaDrawingContext.putImageData(imageData, 0, 0);
    console.log("put image data done");
  }

  private drawLocation(
    ctx: CanvasRenderingContext2D,
    level: IConstructibleLocation["rank"],
    zoom: IZoomState,
    coordinate: ICoordinate,
    isCapital: boolean,
  ): void {
    const color = isCapital ? capitalColor : defaultAreaColor;

    const skip = () => {
      return;
    };
    switch (level) {
      case "rural":
        return zoom.zoomLevel >= zoomLevels.maxedIn
          ? DrawingHelper.drawCircle(ctx, coordinate, 2, color)
          : skip();
      case "town":
        return zoom.zoomLevel >= zoomLevels.strongIn
          ? DrawingHelper.drawSquare(ctx, coordinate, 4, color)
          : skip();
      case "city":
        return zoom.zoomLevel >= zoomLevels.lightIn
          ? DrawingHelper.drawPentagon(ctx, coordinate, 8, color)
          : skip();
      default:
        return;
    }
  }

  private drawConstructibles(gameState: IGameState, zoom: IZoomState): void {
    this.constructibleDrawingContext.clearRect(
      0,
      0,
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const allOwnedLocations = gameState.ownedLocations;
    const drawCallbacks: Array<() => void> = [];

    // Draw all constructibles in one batch
    for (const [locationIdentifier, constructible] of Object.entries(
      allOwnedLocations,
    )) {
      const locationCoordinates =
        this.gameData?.locationDataMap[locationIdentifier]
          .constructibleLocationCoordinate;

      if (locationCoordinates) {
        const { x, y } = DrawingHelper.gameCoordinatesToCanvasCoordinates(
          { x: locationCoordinates.x, y: locationCoordinates.y },
          this.mapInfos.height,
        );

        const level = constructible.rank;

        drawCallbacks.push(() =>
          this.drawLocation(
            this.constructibleDrawingContext,
            level,
            zoom,
            { x, y },
            gameState.capitalLocation === locationIdentifier,
          ),
        );
      }
    }

    DrawingHelper.draw([this.constructibleDrawingContext], drawCallbacks);
  }

  private drawRoads(gameState: IGameState): void {
    console.log("[DrawingService] drawRoads called");
    this.roadDrawingContext.clearRect(
      0,
      0,
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const allRoads = gameState.roads;

    const drawCallbacks: Array<() => void> = [
      () => this.roadDrawingContext.beginPath(),
    ];
    for (const [from, toLocations] of Object.entries(allRoads)) {
      for (const { to, type } of toLocations) {
        const fromCoordinates =
          this.gameData?.locationDataMap[from].constructibleLocationCoordinate;
        const toCoordinates =
          this.gameData?.locationDataMap[to].constructibleLocationCoordinate;

        if (fromCoordinates && toCoordinates) {
          const fromCanvasCoords =
            DrawingHelper.gameCoordinatesToCanvasCoordinates(
              { x: fromCoordinates.x, y: fromCoordinates.y },
              this.mapInfos.height,
            );
          const toCanvasCoords =
            DrawingHelper.gameCoordinatesToCanvasCoordinates(
              { x: toCoordinates.x, y: toCoordinates.y },
              this.mapInfos.height,
            );

          const roadColor = ColorHelper.getRoadHexColor(type);
          drawCallbacks.push(() =>
            DrawingHelper.drawLine(this.roadDrawingContext, {
              canvasCoordFrom: fromCanvasCoords,
              canvasCoordTo: toCanvasCoords,
              lineWidth: 1,
              color: roadColor,
            }),
          );
        }
      }
    }
    DrawingHelper.draw([this.roadDrawingContext], drawCallbacks);
  }
}
