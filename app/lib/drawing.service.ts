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
  cameraController,
  zoomLevels,
} from "@/app/lib/cameraController";
import {
  capitalColor,
  ColorHelper,
  defaultAreaColor,
} from "./drawing/color.helper";
import { Subject } from "./subject";
import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";
import { roadBuilderController } from "@/app/lib/roadBuilderController";

export class DrawingService {
  private areaDrawingCanvas: HTMLCanvasElement;
  private areaDrawingContext: CanvasRenderingContext2D;
  private constructibleDrawingCanvas: HTMLCanvasElement;
  private constructibleDrawingContext: CanvasRenderingContext2D;
  private roadDrawingCanvas: HTMLCanvasElement;
  private roadDrawingContext: CanvasRenderingContext2D;
  private indicatorDrawingCanvas: HTMLCanvasElement;
  private indicatorDrawingContext: CanvasRenderingContext2D;
  private mapInfos: { width: number; height: number };
  private coordinateMap: Record<ILocationIdentifier, Array<ICoordinate>> = {};
  private gameData: IGameData | null = null;
  private drawingCallbackBuffer: Partial<
    Record<"areas" | "constructibles" | "roads" | "indicators", () => unknown>
  > = {};
  private reDraw: Subject<Date> = new Subject<Date>();
  private queriedLocationsColor: Set<ILocationIdentifier> = new Set();

  public addCoordinate(
    name: ILocationIdentifier,
    coordinates: ICoordinate[],
  ): void {
    if (!this.coordinateMap[name]) {
      this.coordinateMap[name] = coordinates;
    }
  }

  private requestColorSearch(missingLocations: ILocationIdentifier[]): void {
    /*  console.log(
      "[DrawingService] requestColorSearch",
      missingLocations,
      this.queriedLocationsColor.entries(),
    ); */
    const notYetQueried = missingLocations.filter(
      (loc) => !this.queriedLocationsColor.has(loc),
    );
    if (notYetQueried.length === 0) {
      return;
    }
    const taskId = `colorSearch-${Date.now()}`;
    const taskPayload: IWorkerTaskColorSearchPayload & {} = {
      canvasWidth: this.areaDrawingCanvas.width,
      canvasHeight: this.areaDrawingCanvas.height,
      startCoordinates: notYetQueried.reduce(
        (acc, loc) => {
          const locData = this.gameData?.locationDataMap[loc];
          if (locData?.centerCoordinates) {
            acc[loc] = locData.centerCoordinates;
          }
          return acc;
        },
        {} as Record<ILocationIdentifier, { x: number; y: number }>,
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

  constructor(
    areaDrawingCanvas: HTMLCanvasElement,
    constructibleDrawingCanvas: HTMLCanvasElement,
    roadDrawingCanvas: HTMLCanvasElement,
    indicatorDrawingCanvas: HTMLCanvasElement,
    mapInfos: { width: number; height: number },
    gameData: IGameData,
  ) {
    this.mapInfos = mapInfos;
    this.gameData = gameData;

    // Area canvas
    this.areaDrawingCanvas = areaDrawingCanvas;
    const areaDrawingContext = this.areaDrawingCanvas.getContext("2d", {});
    if (!areaDrawingContext) {
      throw new Error(
        "DrawingLogicController constructor error: could not get drawing context",
      );
    }
    this.areaDrawingContext = areaDrawingContext;

    // Constructible Canvas
    this.constructibleDrawingCanvas = constructibleDrawingCanvas;
    const constructibleDrawingContext =
      this.constructibleDrawingCanvas.getContext("2d", {});
    if (!constructibleDrawingContext) {
      throw new Error(
        "DrawingLogicController constructor error: could not get constructible drawing context",
      );
    }
    this.constructibleDrawingContext = constructibleDrawingContext;

    // Road canvas
    this.roadDrawingCanvas = roadDrawingCanvas;
    const roadDrawingContext = this.roadDrawingCanvas.getContext("2d", {});
    if (!roadDrawingContext) {
      throw new Error(
        "DrawingLogicController constructor error: could not get road drawing context",
      );
    }
    this.roadDrawingContext = roadDrawingContext;

    // Indicators canvas
    this.indicatorDrawingCanvas = indicatorDrawingCanvas;
    const indicatorDrawingContext = this.indicatorDrawingCanvas.getContext(
      "2d",
      {},
    );
    if (!indicatorDrawingContext) {
      throw new Error(
        "DrawingLogicController constructor error: could not get indicator drawing context",
      );
    }
    this.indicatorDrawingContext = indicatorDrawingContext;

    workerManager.subscribe(({ lastCompletedTask }) => {
      if (!lastCompletedTask) {
        return;
      }
      if (lastCompletedTask.type === "colorSearch") {
        // Handle failed tasks (data is null on error/timeout)
        if (!lastCompletedTask.success || !lastCompletedTask.data) {
          console.warn(
            "[DrawingService] colorSearch task failed or data is missing",
            {
              success: lastCompletedTask.success,
              error: lastCompletedTask.error,
              data: lastCompletedTask.data,
            },
          );
          return;
        }
        const data = lastCompletedTask.data as IWorkerTaskColorSearchResult;
        if (!data.result) {
          console.warn("[DrawingService] colorSearch result is missing", data);
          return;
        }
        const coordinates = data.result;
        for (const [locationName, coords] of Object.entries(coordinates)) {
          this.addCoordinate(locationName, coords);
        }
        this.reDraw.emit(new Date());
      }
    });

    new ObservableCombiner([
      gameStateController,
      proximityComputationController,
    ])
      .debounce(10)
      .subscribe(({ values: [gameState, proximityEvaluation] }) => {
        this.drawingCallbackBuffer["areas"] = () =>
          this.drawAreas(gameState, proximityEvaluation);
        this.drawingCallbackBuffer["roads"] = () => this.drawRoads(gameState);
        this.reDraw.emit(new Date());
      });

    new ObservableCombiner([gameStateController, cameraController])
      .debounce(10)
      .subscribe(({ values: [gameState, zoom] }) => {
        this.drawingCallbackBuffer["constructibles"] = () =>
          this.drawConstructibles(gameState, zoom);
        this.reDraw.emit(new Date());
      });

    new ObservableCombiner([
      actionEventDispatcher.prolongedHoverLocation,
      actionEventDispatcher.hoveredLocation,
      roadBuilderController,
    ]).subscribe(
      ({
        values: [prolongedHoverLocation, hoveredLocation, roadBuilderState],
      }) => {
        const toHighlight = [
          ...(hoveredLocation?.locations ?? []),
          ...(prolongedHoverLocation?.locations ?? []),
          ...(roadBuilderState?.isBuildingAtLocation
            ? [roadBuilderState.isBuildingAtLocation]
            : []),
        ].filter((loc) => !!loc);
        this.drawingCallbackBuffer["indicators"] = () =>
          this.drawHighlighted(toHighlight);
        this.reDraw.emit(new Date());
      },
    );

    this.reDraw.debounce(5).subscribe(() => {
      // TODO: type drawingCallbackBuffer better to avoid all the casts
      if (this.drawingCallbackBuffer["areas"]) {
        const missingCoordinates = this.drawingCallbackBuffer[
          "areas"
        ]() as ILocationIdentifier[];

        if (!missingCoordinates?.length) {
          delete this.drawingCallbackBuffer["areas"];
        } else {
          this.reDraw.emit(new Date()); //try again when missing coordinates get there
        }
      }
      if (this.drawingCallbackBuffer["roads"]) {
        this.drawingCallbackBuffer["roads"]();
        delete this.drawingCallbackBuffer["roads"];
      }
      if (this.drawingCallbackBuffer["constructibles"]) {
        this.drawingCallbackBuffer["constructibles"]();
        delete this.drawingCallbackBuffer["constructibles"];
      }
      if (this.drawingCallbackBuffer["indicators"]) {
        const missingCoordinates = this.drawingCallbackBuffer[
          "indicators"
        ]() as ILocationIdentifier[];
        if (!missingCoordinates?.length) {
          delete this.drawingCallbackBuffer["indicators"];
        } else {
          this.reDraw.emit(new Date()); //try again when missing coordinates get there
        }
      }
    });

    actionEventDispatcher.prolongedHoverLocation.emit({
      locations: [],
      type: null,
    }); // don't like this, but need a way to set first emition for now
    this.reDraw.emit(new Date()); // this has to be after subscriptions are set up
  }

  private drawAreas(
    gameState: IGameState,
    proximityEvaluation: IProximityComputationResults,
  ): ILocationIdentifier[] {
    const imageData = this.areaDrawingContext.createImageData(
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const data = imageData.data;

    const missingCoordinates: ILocationIdentifier[] = [];
    for (const location of Object.keys(gameState.ownedLocations)) {
      const coordinates = this.coordinateMap[location];
      if (!coordinates) {
        missingCoordinates.push(location);
        continue;
      }
      const evaluation: number | undefined =
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

    if (missingCoordinates.length > 0) {
      this.requestColorSearch(missingCoordinates);
    }

    // Draw once
    this.areaDrawingContext.putImageData(imageData, 0, 0);
    return missingCoordinates;
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
        this.gameData?.locationDataMap[locationIdentifier].centerCoordinates;

      if (locationCoordinates) {
        const { x, y } = locationCoordinates;
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
          this.gameData?.locationDataMap[from].centerCoordinates;
        const toCoordinates =
          this.gameData?.locationDataMap[to].centerCoordinates;

        if (fromCoordinates && toCoordinates) {
          const roadColor = ColorHelper.getRoadHexColor(type);
          drawCallbacks.push(() =>
            DrawingHelper.drawLine(this.roadDrawingContext, {
              canvasCoordFrom: fromCoordinates,
              canvasCoordTo: toCoordinates,
              lineWidth: 1,
              color: roadColor,
            }),
          );
        }
      }
    }
    DrawingHelper.draw([this.roadDrawingContext], drawCallbacks);
  }

  private drawHighlighted(
    locations: ILocationIdentifier[],
  ): ILocationIdentifier[] {
    const toHighlight: Record<ILocationIdentifier, ICoordinate[]> = {};
    const missingCoordinates: ILocationIdentifier[] = [];

    for (const location of locations) {
      if (!(location in this.coordinateMap)) {
        missingCoordinates.push(location);
      } else {
        toHighlight[location] = this.coordinateMap[location];
      }
    }

    if (missingCoordinates.length > 0) {
      this.requestColorSearch(missingCoordinates);
    }

    /* console.log("[DrawingService] will draw highlighted:", toHighlight); */

    DrawingHelper.draw(
      [this.indicatorDrawingContext],
      [
        () =>
          this.indicatorDrawingContext.clearRect(
            0,
            0,
            this.mapInfos.width,
            this.mapInfos.height,
          ),
        () =>
          DrawingHelper.drawHighlights(
            this.indicatorDrawingContext,
            Object.values(toHighlight),
          ),
      ],
    );

    return missingCoordinates;
  }
}
