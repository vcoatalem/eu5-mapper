import { ICoordinate } from "../types/general";

export class DrawingHelper {
  public static gameCoordinatesToCanvasCoordinates(
    gameCoordinates: ICoordinate,
    canvasHeight: number,
  ): ICoordinate {
    return { x: gameCoordinates.x, y: canvasHeight - gameCoordinates.y };
  }
}
