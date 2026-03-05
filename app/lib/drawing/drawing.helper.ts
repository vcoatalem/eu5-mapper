import { ICoordinate } from "@/app/lib/types/coordinate";

export class DrawingHelper {
  public static drawCircle(
    ctx: CanvasRenderingContext2D,
    canvasCoordinate: ICoordinate,
    radius: number,
    color: string,
  ): void {
    ctx.beginPath();
    ctx.arc(canvasCoordinate.x, canvasCoordinate.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  public static drawSquare(
    ctx: CanvasRenderingContext2D,
    canvasCoordinate: ICoordinate,
    size: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(
      canvasCoordinate.x - size / 2,
      canvasCoordinate.y - size / 2,
      size,
      size,
    );
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      canvasCoordinate.x - size / 2,
      canvasCoordinate.y - size / 2,
      size,
      size,
    );
  }

  public static drawPentagon(
    ctx: CanvasRenderingContext2D,
    canvasCoordinate: ICoordinate,
    size: number,
    color: string,
  ): void {
    const radius = size / 2;
    ctx.beginPath();
    // Diamond square: 4 vertices (top, right, bottom, left)
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 - Math.PI / 2; // Start from top
      const px = canvasCoordinate.x + radius * Math.cos(angle);
      const py = canvasCoordinate.y + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  public static drawLine(
    ctx: CanvasRenderingContext2D,
    drawParams: {
      canvasCoordFrom: ICoordinate;
      canvasCoordTo: ICoordinate;
      lineWidth: number;
      color: string;
    },
  ): void {
    ctx.beginPath();
    ctx.moveTo(drawParams.canvasCoordFrom.x, drawParams.canvasCoordFrom.y);
    ctx.lineTo(drawParams.canvasCoordTo.x, drawParams.canvasCoordTo.y);
    ctx.strokeStyle = drawParams.color;
    ctx.lineWidth = drawParams.lineWidth;
    ctx.stroke();
    //console.log("drawLine done", { canvasCoordFrom, canvasCoordTo });
  }

  public static drawHighlights(
    ctx: CanvasRenderingContext2D,
    borderCanvas: ICoordinate[][],
    colorFn: (...args: unknown[]) => string = () => "rgba(255,255,255,0.5)",
    colorFnArgs?: unknown[],
  ): void {
    ctx.save();
    ctx.fillStyle = colorFn(...(colorFnArgs ?? []));
    for (const coords of borderCanvas) {
      for (const c of coords) {
        ctx.fillRect(c.x, c.y, 1, 1);
      }
    }
    ctx.restore();
  }

  public static draw(
    ctx: CanvasRenderingContext2D[],
    drawMethods: Array<() => void>,
  ): void {
    for (const drawMethod of drawMethods) {
      drawMethod();
    }
    for (const c of ctx) {
      c.stroke();
    }
  }
}
