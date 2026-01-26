import { GameLogicController } from "./gameLogicController";
import { ICoordinate, ILocationDataMap, ILocationIdentifier } from "./types";

export class DrawingLogicController {
  private canvas: HTMLCanvasElement;
  private canvasContext: CanvasRenderingContext2D;
  private mapInfos: { width: number; height: number };
  private coordinateMap: Record<ILocationIdentifier, Array<ICoordinate>> = {};
  private gameLogicController: GameLogicController | null = null;
  private locationDataMap: ILocationDataMap | null = null;

  public addCoordinate(
    name: ILocationIdentifier,
    coordinates: ICoordinate[]
  ): void {
    if (!this.coordinateMap[name]) {
      this.coordinateMap[name] = coordinates;
    }

    this.drawGameState();
  }

  constructor(
    canvas: HTMLCanvasElement,
    mapInfos: { width: number; height: number },
    gameLogicController: GameLogicController,
    locationDataMap: ILocationDataMap
  ) {
    this.canvas = canvas;
    this.mapInfos = mapInfos;
    this.gameLogicController = gameLogicController;
    this.locationDataMap = locationDataMap;
    const context = this.canvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!context) {
      throw new Error(
        "DrawingLogicController constructor error: could not get drawing context"
      );
    }
    this.canvasContext = context;

    this.gameLogicController.subscribe(() => {
      this.drawGameState();
    });
  }

  private drawGameState(): void {
    if (!this.gameLogicController) {
      throw new Error(
        "no game logic controller set in drawing logic controller"
      );
    }

    if (!this.locationDataMap) {
      throw new Error("no location data map set in drawing logic controller");
    }

    const coordinates: Array<ICoordinate> = this.gameLogicController
      .getAllSelectedLocations()
      .flatMap((locationName) => this.coordinateMap[locationName] || null)
      .filter((coord) => !!coord);

    const imageData = this.canvasContext.createImageData(
      this.mapInfos.width,
      this.mapInfos.height
    );

    const data = imageData.data;

    // Plot all pixels at once
    coordinates.forEach(({ x, y }) => {
      const index = (y * this.mapInfos.width + x) * 4;
      data[index] = 255; // R
      data[index + 1] = 255; // G
      data[index + 2] = 255; // B
      data[index + 3] = 255; // A
    });

    // Draw once
    this.canvasContext.putImageData(imageData, 0, 0);
    console.log("put image data done");
  }
}
