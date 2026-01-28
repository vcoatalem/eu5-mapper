import { gameStateController } from "@/app/lib/gameStateController";
import {
  IConstructibleLocation,
  ICoordinate,
  IGameData,
  IGameState,
  ILocationIdentifier,
} from "./types/general";

//TODO drawingLogicService more like ? need a wording to differentiate observables & non observables
export class DrawingLogicController {
  private areaDrawingCanvas: HTMLCanvasElement;
  private areaDrawingContext: CanvasRenderingContext2D;
  private constructibleDrawingCanvas: HTMLCanvasElement;
  private constructibleDrawingContext: CanvasRenderingContext2D;
  private mapInfos: { width: number; height: number };
  private coordinateMap: Record<ILocationIdentifier, Array<ICoordinate>> = {};
  private gameData: IGameData | null = null;
  private lastKnownGameState: IGameState | null = null;

  private drawCircle(x: number, y: number, radius: number): void {
    this.constructibleDrawingContext.beginPath();
    this.constructibleDrawingContext.arc(x, y, radius, 0, 2 * Math.PI);
    this.constructibleDrawingContext.fillStyle = "rgb(208, 208, 208)";
    this.constructibleDrawingContext.fill();
    this.constructibleDrawingContext.strokeStyle = "black";
    this.constructibleDrawingContext.lineWidth = 1;
    this.constructibleDrawingContext.stroke();
  }

  private drawSquare(x: number, y: number, size: number): void {
    this.constructibleDrawingContext.fillStyle = "rgb(208, 208, 208)";
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

  private drawPentagon(x: number, y: number, size: number): void {
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
    this.constructibleDrawingContext.fillStyle = "rgb(208, 208, 208)";
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
      // TODO: separate subscription for drawing areas and drawing constructibles
      this.lastKnownGameState = gameState;
      this.drawAreas();
      this.drawConstructible();
    });
  }

  private drawAreas(): void {
    if (!this.lastKnownGameState) {
      throw new Error("no game state available for drawing areas");
    }
    const coordinates: Array<ICoordinate> = Object.entries(
      this.lastKnownGameState.ownedLocations,
    )
      .flatMap(
        ([locationName, _locationData]) =>
          this.coordinateMap[locationName] || null,
      )
      .filter((coord) => !!coord);

    const imageData = this.areaDrawingContext.createImageData(
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const data = imageData.data;
    // Plot all pixels at once
    coordinates.forEach(({ x, y }) => {
      const index = (y * this.mapInfos.width + x) * 4;

      data[index] = 208; // R
      data[index + 1] = 208; // G
      data[index + 2] = 208; // B
      data[index + 3] = 255; // A
    });

    // Draw once
    this.areaDrawingContext.putImageData(imageData, 0, 0);
    console.log("put image data done");
  }

  private drawConstructible(): void {
    if (!this.lastKnownGameState) {
      throw new Error(
        "no game state controller set in drawing logic controller",
      );
    }

    // Clear the canvas first TODO: see if this is needed
    this.constructibleDrawingContext.clearRect(
      0,
      0,
      this.mapInfos.width,
      this.mapInfos.height,
    );

    // read game state controller for currently owned constructibles
    const allOwnedLocations = this.lastKnownGameState.ownedLocations;

    // Draw all constructibles in one batch
    for (const [locationIdentifier, constructible] of Object.entries(
      allOwnedLocations,
    )) {
      const locationData = this.gameData?.locationDataMap[locationIdentifier];
      if (!locationData) {
        console.warn(
          `Location ${locationIdentifier} not found in locationDataMap`,
        );
        continue;
      }

      const locationCoordinates = locationData.constructibleLocationCoordinate;

      if (locationCoordinates) {
        // Convert game world coordinates to canvas coordinates
        // Game world Y goes up (north), canvas Y goes down (south)
        const canvasX = locationCoordinates.x;
        const canvasY = this.mapInfos.height - locationCoordinates.y;

        const level = constructible.level;
        if (level === "rural") {
          this.drawCircle(canvasX, canvasY, 3.5);
        } else if (level === "town") {
          this.drawSquare(canvasX, canvasY, 8);
        } else if (level === "city") {
          this.drawPentagon(canvasX, canvasY, 10);
        }
      }
    }
  }
}
