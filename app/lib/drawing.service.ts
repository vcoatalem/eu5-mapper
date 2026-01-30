import { gameStateController } from "@/app/lib/gameState.controller";
import {
  IProximityComputationResults,
  proximityComputationController,
} from "@/app/lib/proximityComputation.controller";
import {
  ICoordinate,
  IGameData,
  IGameState,
  ILocationIdentifier,
} from "./types/general";
import { workerManager } from "./workerManager";
import { ObservableCombiner } from "./observableCombiner";
import { DrawingHelper } from "./drawing/drawing.helper";
import { IWorkerTaskColorSearchResult } from "@/workers/types/workerTypes";

export class DrawingService {
  private areaDrawingCanvas: HTMLCanvasElement;
  private areaDrawingContext: CanvasRenderingContext2D;
  private constructibleDrawingCanvas: HTMLCanvasElement;
  private constructibleDrawingContext: CanvasRenderingContext2D;
  private mapInfos: { width: number; height: number };
  private coordinateMap: Record<ILocationIdentifier, Array<ICoordinate>> = {};
  private gameData: IGameData | null = null;

  private gameStateSnapshot: IGameState | null = null;
  private proximityComputationSnapshot: IProximityComputationResults | null =
    null;

  private drawCircle(
    x: number,
    y: number,
    radius: number,
    color: string,
  ): void {
    this.constructibleDrawingContext.beginPath();
    this.constructibleDrawingContext.arc(x, y, radius, 0, 2 * Math.PI);
    this.constructibleDrawingContext.fillStyle = color;
    this.constructibleDrawingContext.fill();
    this.constructibleDrawingContext.strokeStyle = "black";
    this.constructibleDrawingContext.lineWidth = 1;
    this.constructibleDrawingContext.stroke();
  }

  private drawSquare(x: number, y: number, size: number, color: string): void {
    this.constructibleDrawingContext.fillStyle = color;
    this.constructibleDrawingContext.fillRect(
      x - size / 2,
      y - size / 2,
      size,
      size,
    );
    this.constructibleDrawingContext.strokeStyle = "black";
    this.constructibleDrawingContext.lineWidth = 1;
    this.constructibleDrawingContext.strokeRect(
      x - size / 2,
      y - size / 2,
      size,
      size,
    );
  }

  private drawPentagon(
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    const radius = size / 2;
    this.constructibleDrawingContext.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2; // Start from top
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) {
        this.constructibleDrawingContext.moveTo(px, py);
      } else {
        this.constructibleDrawingContext.lineTo(px, py);
      }
    }
    this.constructibleDrawingContext.closePath();
    this.constructibleDrawingContext.fillStyle = color;
    this.constructibleDrawingContext.fill();
    this.constructibleDrawingContext.strokeStyle = "black";
    this.constructibleDrawingContext.lineWidth = 1;
    this.constructibleDrawingContext.stroke();
  }

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
    mapInfos: { width: number; height: number },
    gameData: IGameData,
  ) {
    this.areaDrawingCanvas = areaDrawingCanvas;
    this.constructibleDrawingCanvas = constructibleDrawingCanvas;
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

    workerManager.subscribe(({ lastCompletedTask }) => {
      console.log(
        "[DrawingLogicController] WorkerManager status update on lastCompletedTask",
        {
          lastCompletedTask,
        },
      );
      if (!lastCompletedTask) {
        return;
      }

      if (lastCompletedTask.type === "colorSearch") {
        const data = lastCompletedTask.data as IWorkerTaskColorSearchResult;
        this.addCoordinate(
          data.locationName,
          data.coordinates as ICoordinate[],
        );
        if (this.gameStateSnapshot) {
          if (this.proximityComputationSnapshot) {
            this.drawAreas(
              this.gameStateSnapshot,
              this.proximityComputationSnapshot,
            );
          }
          this.drawConstructible(this.gameStateSnapshot!);
        }
      }
    });

    new ObservableCombiner([
      gameStateController,
      proximityComputationController,
    ])
      .debounce(10)
      .subscribe(
        ({ values: [gameState, proximityEvaluation], changedIndex }) => {
          console.log(
            "[DrawingLogicController] game state and proximity subscription triggered",
            {
              gameState,
              proximityEvaluation,
              changedIndex,
            },
          );

          this.gameStateSnapshot = gameState;
          this.proximityComputationSnapshot = proximityEvaluation;

          /* if (changedIndex === 0) {
            if (
              !lastCompletedTask ||
              (lastCompletedTask.type !== "colorSearch" &&
                lastCompletedTask.type !== "computeProximity")
            ) {
              return; // Don't redraw if subscription was triggered by a task that is not non-colorSearch tasks
            }
          } */

          this.drawAreas(gameState, proximityEvaluation);
          this.drawConstructible(gameState);
        },
      );
  }

  private drawAreas(
    gameState: IGameState,
    proximityEvaluation: IProximityComputationResults,
  ): void {
    const imageData = this.areaDrawingContext.createImageData(
      this.mapInfos.width,
      this.mapInfos.height,
    );

    console.log("drawAreas called", { gameState, proximityEvaluation });

    const data = imageData.data;

    let missingCoordinates: ILocationIdentifier[] = [];
    for (const location of Object.keys(gameState.ownedLocations)) {
      /*       console.log(
        "will draw location:",
        location,
        proximityEvaluation.result,
        greenToRedGradient.length,
      ); */
      const coordinates = this.coordinateMap[location];
      if (!coordinates) {
        missingCoordinates.push(location);
        continue;
      }
      let evaluation: number | undefined =
        proximityEvaluation.result?.[location] ?? -1;

      /* console.log("location evaluation:", location, evaluation); */

      const color = DrawingHelper.getEvaluationColor(evaluation);

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
      for (const location of missingCoordinates) {
        const locationData = this.gameData?.locationDataMap[location];
        if (!locationData) {
          continue;
        }
        const taskId = `colorSearch-${location}`;
        workerManager.queueTask({
          id: taskId,
          type: "colorSearch",
          payload: {
            type: "colorSearch",
            canvasWidth: this.areaDrawingCanvas.width,
            canvasHeight: this.areaDrawingCanvas.height,
            startCoordinates: DrawingHelper.gameCoordinatesToCanvasCoordinates(
              locationData.constructibleLocationCoordinate ?? { x: 0, y: 0 },
              this.areaDrawingCanvas.height,
            ),
            locationName: location,
          },
        });
      }
    }

    // Draw once
    this.areaDrawingContext.putImageData(imageData, 0, 0);
    console.log("put image data done");
  }

  private drawConstructible(gameState: IGameState): void {
    this.constructibleDrawingContext.clearRect(
      0,
      0,
      this.mapInfos.width,
      this.mapInfos.height,
    );

    // read game logic controller for currently owned constructibles
    const allOwnedLocations = gameState.ownedLocations;

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

        const color =
          gameState.capitalLocation === locationIdentifier
            ? "rgb(250, 219, 17)"
            : "rgb(208, 208, 208)";

        const level = constructible.level;
        if (level === "rural") {
          this.drawCircle(x, y, 2, color);
        } else if (level === "town") {
          this.drawSquare(x, y, 4, color);
        } else if (level === "city") {
          this.drawPentagon(x, y, 8, color);
        }
      }
    }
  }
}
