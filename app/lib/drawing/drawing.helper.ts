import { ICoordinate } from "../types/general";
import { greenToRedGradient } from "./greenToRedGradient.const";

export class DrawingHelper {
  public static gameCoordinatesToCanvasCoordinates(
    gameCoordinates: ICoordinate,
    canvasHeight: number,
  ): ICoordinate {
    return { x: gameCoordinates.x, y: canvasHeight - gameCoordinates.y };
  }

  public static getEvaluationColor(
    evaluation: number,
  ): [r: number, g: number, b: number] {
    const rounded = Math.round(evaluation);
    if (evaluation < 0 || evaluation > 100) {
      return [208, 208, 208]; // Grey for invalid evaluations
    } else {
      const [r, g, b] = greenToRedGradient[rounded];
      return [r, g, b];
    }
  }

  private static componentToHex(c: number): string {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }
  public static rgbToHex(r: number, g: number, b: number): string {
    return (
      "#" +
      this.componentToHex(r) +
      this.componentToHex(g) +
      this.componentToHex(b)
    );
  }
}
