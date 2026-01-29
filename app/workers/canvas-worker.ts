import type { ICoordinate } from "../lib/types/general";
import {
  IWorkerTask,
  IWorkerTaskColorSearchPayload,
  IWorkerTaskInitWithImagePayload,
} from "./types/workerTypes";

//type Coordinate = { x: number; y: number };
/**
 * Flood fill algorithm to find all contiguous pixels of the same color.
 * @param data32 - Uint32Array of pixel data
 * @param width - width of the image
 * @param startX - starting x coordinate
 * @param startY - starting y coordinate
 * @returns Array of coordinates belonging to the filled region
 */
const scanlineFill = (
  data32: Uint32Array,
  width: number,
  startX: number,
  startY: number,
): ICoordinate[] => {
  const height = data32.length / width;
  const visited = new Uint8Array(data32.length);

  // Normalize and validate starting coordinates
  const x = Math.floor(startX);
  const y = Math.floor(startY);

  if (x < 0 || x >= width || y < 0 || y >= height) {
    return [];
  }

  // Get target color (mask alpha channel like getAllCoordinatesOfColor)
  const startIdx = y * width + x;
  const targetColor32 = data32[startIdx] & 0x00ffffff;
  const coords: ICoordinate[] = [];
  const stack: [number, number][] = [[x, y]];
  const maxIterations = width * height;
  let iterations = 0;

  // Neighbor offsets: [dx, dy]
  const neighbors: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (stack.length > 0 && iterations < maxIterations) {
    iterations++;
    const popped = stack.pop();
    if (!popped) continue;
    const [cx, cy] = popped;
    const idx = cy * width + cx;

    // Skip if already visited or wrong color
    if (visited[idx]) continue;

    const currentColor = data32[idx] & 0x00ffffff;
    if (currentColor !== targetColor32) continue;

    // Mark as visited and add to results
    visited[idx] = 1;
    coords.push({ x: cx, y: cy });

    // Check and add valid neighbors
    for (const [dx, dy] of neighbors) {
      const nx = cx + dx;
      const ny = cy + dy;

      // Bounds check
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const neighborIdx = ny * width + nx;
      if (
        !visited[neighborIdx] &&
        (data32[neighborIdx] & 0x00ffffff) === targetColor32
      ) {
        stack.push([nx, ny]);
      }
    }
  }

  if (iterations >= maxIterations) {
    self.postMessage({
      type: "log",
      message: `scanlineFill hit max iterations: ${maxIterations}, stack: ${stack.length}, coords: ${coords.length}`,
    });
  }

  return coords;
};

let pixelData32: Uint32Array; // Uint32Array for fast pixel access
let canvasWidth: number;
let canvasHeight: number;

self.onmessage = function (e: MessageEvent<IWorkerTask>) {
  const taskId = e.data.id;

  switch (e.data.type) {
    case "initWithImage":
      try {
        const payload = e.data.payload as IWorkerTaskInitWithImagePayload;

        canvasWidth = payload.canvasWidth;
        canvasHeight = payload.canvasHeight;

        // Receive ArrayBuffer and wrap in Uint8ClampedArray
        const pixelDataBuffer = payload.pixelDataBuffer;
        const pixelData8 = new Uint8ClampedArray(pixelDataBuffer);

        // Create Uint32Array view for fast pixel comparison
        pixelData32 = new Uint32Array(pixelData8.buffer);

        self.postMessage({
          type: "result",
          taskId: taskId,
          data: {
            success: true,
            message: "Worker initialized with pixel data",
          },
        });
      } catch (err) {
        self.postMessage({
          type: "error",
          taskId: taskId,
          message: `something went wrong during worker init: ${(err as any).message}`,
        });
      }
      break;

    case "colorSearch":
      try {
        if (!pixelData32) {
          throw new Error(
            "Image data not initialized. Must call 'initWithImage' first.",
          );
        }

        const payload = e.data.payload as IWorkerTaskColorSearchPayload;

        if (payload.startCoordinates?.x && payload.startCoordinates?.y) {
          try {
            const coordinates = scanlineFill(
              pixelData32,
              canvasWidth,
              payload.startCoordinates.x,
              payload.startCoordinates.y,
            );

            self.postMessage({
              type: "result",
              taskId: taskId,
              data: {
                coordinates: coordinates,
                locationName: payload.locationName,
              },
            });
          } catch (err) {
            self.postMessage({
              type: "error",
              taskId: taskId,
              message: `Scanline fill failed: ${(err as any).message}`,
            });
          }
        } else {
          throw new Error("Invalid color search payload");
        }
      } catch (err) {
        self.postMessage({
          type: "error",
          taskId: taskId,
          message: `Color search failed: ${err}`,
        });
      }
      break;

    default:
      self.postMessage({
        type: "error",
        taskId: taskId,
        message: `Unknown task type: ${e.data.type}`,
      });
  }
};
