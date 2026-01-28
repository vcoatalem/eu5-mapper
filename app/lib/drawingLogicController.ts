import { gameStateController } from "@/app/lib/gameStateController";
import {
  IProximityComputationResults,
  proximityComputationController,
} from "@/app/lib/proximityComputationController";
import {
  ICoordinate,
  IGameData,
  IGameState,
  ILocationIdentifier,
} from "./types/general";
import { greenToRedGradient } from "./drawing/greenToRedGradient.const";
import { workerManager } from "./workerManager";
import { ObservableCombiner } from "./observableCombiner";

export class DrawingLogicController {
  private areaDrawingCanvas: HTMLCanvasElement;
  private areaDrawingContext: CanvasRenderingContext2D;
  private constructibleDrawingCanvas: HTMLCanvasElement;
  private constructibleDrawingContext: CanvasRenderingContext2D;
  private mapInfos: { width: number; height: number };
  private coordinateMap: Record<ILocationIdentifier, Array<ICoordinate>> = {};
  private gameData: IGameData | null = null;

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

    const observeGameStateAndComputation = new ObservableCombiner([
      gameStateController,
      proximityComputationController,
    ]).debounce(10);
    new ObservableCombiner([workerManager, observeGameStateAndComputation])
      .debounce(10)
      .subscribe(
        ({
          values: [
            { lastCompletedTask },
            {
              values: [gameState, proximityEvaluation],
            },
          ],
          changedIndex,
        }) => {
          if (changedIndex === 0) {
            if (lastCompletedTask && lastCompletedTask.type === "colorSearch") {
              const data = lastCompletedTask.data as {
                locationName: ILocationIdentifier;
                coordinates: ICoordinate[];
              };
              this.addCoordinate(
                data.locationName,
                data.coordinates as ICoordinate[],
              );
              console.log(
                "[DrawingLogicController] got color task result",
                data,
              );
            } else {
              return;
            }
          }
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

    const data = imageData.data;

    for (const location of Object.keys(gameState.ownedLocations)) {
      const coordinates = this.coordinateMap[location];
      if (!coordinates) {
        continue;
      }
      const evaluation =
        proximityEvaluation.proximityCostsForCapital?.get(location) ??
        undefined;
      const [r, g, b] =
        evaluation !== undefined
          ? greenToRedGradient[Math.round(evaluation)]
          : [208, 208, 208];

      for (const { x, y } of coordinates) {
        const index = (y * this.mapInfos.width + x) * 4;
        data[index] = r; // R
        data[index + 1] = g; // G
        data[index + 2] = b; // B
        data[index + 3] = 255; // A
      }
    }

    // Draw once
    this.areaDrawingContext.putImageData(imageData, 0, 0);
    console.log("put image data done");
  }

  private drawConstructible(gameState: IGameState): void {
    // Clear the canvas first TODO: see if this is needed
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
        // Convert game world coordinates to canvas coordinates
        // Game world Y goes up (north), canvas Y goes down (south)
        const canvasX = locationCoordinates.x;
        const canvasY = this.mapInfos.height - locationCoordinates.y;

        const color =
          gameState.capitalLocation === locationIdentifier
            ? "rgb(250, 219, 17)"
            : "rgb(208, 208, 208)";

        const level = constructible.level;
        if (level === "rural") {
          this.drawCircle(canvasX, canvasY, 2, color);
        } else if (level === "town") {
          this.drawSquare(canvasX, canvasY, 4, color);
        } else if (level === "city") {
          this.drawPentagon(canvasX, canvasY, 8, color);
        }
      }
    }
  }
}
