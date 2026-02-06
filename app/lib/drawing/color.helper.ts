import { RoadType } from "../types/general";
import { greenToRedGradient } from "./greenToRedGradient.const";

export const defaultAreaColor = "#d0d0d0";
export const capitalColor = "#fadb11";

const gravelRoadColor = "#5e0000";
const pavedRoadColor = "#850101";
const modernRoadColor = "#bd0202";
const railroadColor = "#f70202";

export class ColorHelper {
  public static componentToHex(c: number): string {
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

  public static hexToRgb(hex: string): [number, number, number] {
    // Remove leading # if present
    if (hex.startsWith("#")) hex = hex.slice(1);
    if (hex.length !== 6) return this.hexToRgb(defaultAreaColor);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((v) => isNaN(v))) return this.hexToRgb(defaultAreaColor);
    return [r, g, b];
  }

  public static getEvaluationColor(
    evaluation: number,
  ): [r: number, g: number, b: number] {
    const rounded = Math.round(evaluation);
    if (evaluation < 0 || evaluation > 100) {
      return this.hexToRgb(defaultAreaColor); // Grey for invalid evaluations
    } else {
      const color = greenToRedGradient[rounded];
      if (color?.length !== 3) {
        console.warn(
          "[DrawingHelper] invalid color in gradient:",
          color,
          evaluation,
        );
        return this.hexToRgb(defaultAreaColor);
      }
      const [r, g, b] = color;
      return [r, g, b];
    }
  }

  public static getProximityColor(
    proximity: number,
  ): [r: number, g: number, b: number] {
    return this.getEvaluationColor(100 - proximity);
  }

  public static getRoadHexColor(roadType: RoadType): string {
    switch (roadType) {
      case "gravel_road":
        return gravelRoadColor;
      case "paved_road":
        return pavedRoadColor;
      case "modern_road":
        return modernRoadColor;
      case "rail_road":
        return railroadColor;
      default:
        return "#000000"; // Default to black if unknown
    }
  }
}
