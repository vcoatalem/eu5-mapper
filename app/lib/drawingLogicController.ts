import { gameStateController } from "@/app/lib/gameStateController";
import {
  IProximityComputationResults,
  proximityComputationController,
} from "@/app/lib/proximityComputationController";
import {
  IConstructibleLocation,
  ICoordinate,
  IGameData,
  IGameState,
  ILocationIdentifier,
} from "./types/general";
import { greenToRedGradient } from "./drawing/greenToRedGradient";

export class DrawingLogicController {
  private areaDrawingCanvas: HTMLCanvasElement;
  private areaDrawingContext: CanvasRenderingContext2D;
  private constructibleDrawingCanvas: HTMLCanvasElement;
  private constructibleDrawingContext: CanvasRenderingContext2D;
  private mapInfos: { width: number; height: number };
  private coordinateMap: Record<ILocationIdentifier, Array<ICoordinate>> = {};
  private gameData: IGameData | null = null;
  private lastKnownGameState: IGameState | null = null;
  private lastKnownProximityComputationResults: IProximityComputationResults | null =
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

    // this is less than ideal. Need to find a better solution so that we don't have to keep 'lastKnown...' attributes in this class.
    this.drawAreas();
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

    gameStateController.subscribe((gameState) => {
      console.log("gameStateController subscribe");
      // TODO: separate subscription for drawing areas and drawing constructibles
      this.lastKnownGameState = gameState;
      this.drawAreas();
      this.drawConstructible();
    });

    proximityComputationController.subscribe((reachable) => {
      console.log("proximityComputationController subscribe");
      console.log("reachable areas: ", {
        reachable,
        context: {
          gameState: this.lastKnownGameState,
          proximity: this.lastKnownProximityComputationResults,
        },
      });
      this.lastKnownProximityComputationResults = reachable;

      this.drawAreas();
      //this.drawPathFindingHeatMap(reachable);
    });
  }

  private drawAreas(): void {
    if (!this.lastKnownGameState) {
      return;
    }

    const imageData = this.areaDrawingContext.createImageData(
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const data = imageData.data;

    for (const location of Object.keys(
      this.lastKnownGameState.ownedLocations,
    )) {
      const coordinates = this.coordinateMap[location];
      if (!coordinates) {
        continue;
      }
      const proximityEvaluation =
        this.lastKnownProximityComputationResults?.proximityCostsForCapital?.get(
          location ?? "",
        );
      console.log("proximity evaluation for location", {
        location,
        proximityEvaluation,
      });
      const [r, g, b] =
        proximityEvaluation !== undefined
          ? greenToRedGradient[Math.round(proximityEvaluation)]
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

  private drawConstructible(): void {
    if (!this.lastKnownGameState) {
      throw new Error("no game state found");
    }

    // Clear the canvas first TODO: see if this is needed
    this.constructibleDrawingContext.clearRect(
      0,
      0,
      this.mapInfos.width,
      this.mapInfos.height,
    );

    // read game logic controller for currently owned constructibles
    const allOwnedLocations = this.lastKnownGameState.ownedLocations;

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
          this.lastKnownGameState.capitalLocation === locationIdentifier
            ? "rgb(250, 219, 17)"
            : "rgb(208, 208, 208)";

        const level = constructible.level;
        if (level === "rural") {
          this.drawCircle(canvasX, canvasY, 2, color);
        } else if (level === "town") {
          this.drawSquare(canvasX, canvasY, 4, color);
        } else if (level === "city") {
          this.drawPentagon(canvasX, canvasY, 6, color);
        }
      }
    }
  }
}
