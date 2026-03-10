import { IWorkerTask } from "@/workers/types/task";
import { sendMessage } from "./utils";
import { ICoordinate } from "@/app/lib/types/coordinate";
import { ZodWorkerTaskInitWithImagePayload } from "@/workers/types/initWithImage";
import {
  IWorkerTaskColorSearchResult,
  ZodWorkerTaskColorSearchPayload,
} from "@/workers/types/colorSearch";

(globalThis as any).__workerName = "Canvas Worker";

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
  task: IWorkerTask,
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
    sendMessage(self, {
      level: "log",
      message: `scanlineFill hit max iterations: ${maxIterations}, stack: ${stack.length}, coords: ${coords.length}`,
      task,
      data: null,
    });
    // No task context here, so can't use sendMessage for this log
    // (would need to pass task info if needed)
    self.postMessage({});
  }

  return coords;
};

let pixelData32: Uint32Array; // Uint32Array for fast pixel access
let canvasWidth: number;
let canvasHeight: number;

self.onmessage = function (e: MessageEvent<IWorkerTask>) {
  sendMessage(self, {
    data: e.data.payload,
    message: `Received task of type ${e.data.type}: ${e.data.id}`,
    level: "log",
    task: e.data,
  });

  switch (e.data.type) {
    case "initWithImage":
      try {
        const payload = ZodWorkerTaskInitWithImagePayload.parse(e.data.payload);

        canvasWidth = payload.canvasWidth;
        canvasHeight = payload.canvasHeight;

        // Receive ArrayBuffer and wrap in Uint8ClampedArray
        const pixelDataBuffer = payload.pixelDataBuffer;
        const pixelData8 = new Uint8ClampedArray(pixelDataBuffer);

        // Create Uint32Array view for fast pixel comparison
        pixelData32 = new Uint32Array(pixelData8.buffer);

        sendMessage(self, {
          data: {
            success: true,
            message: "Worker initialized with pixel data",
          },
          message: "Worker initialized with pixel data",
          level: "result",
          task: e.data,
        });
      } catch (err) {
        sendMessage(self, {
          data: null,
          message: `something went wrong during worker init: ${(err as any).message}`,
          level: "error",
          task: e.data,
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

        const payload = ZodWorkerTaskColorSearchPayload.parse(e.data.payload);

        const result: IWorkerTaskColorSearchResult = { result: {} };

        try {
          for (const [locationName, coordinates] of Object.entries(
            payload.coordinates,
          )) {
            const foundCoordinates: ICoordinate[] = coordinates.reduce(
              (prev, { x, y }) => {
                const regionCoords = scanlineFill(
                  pixelData32,
                  canvasWidth,
                  x,
                  y,
                  e.data,
                );
                return prev.concat(regionCoords);
              },
              [] as ICoordinate[],
            );

            result.result[locationName] = foundCoordinates;
          }
        } catch (err) {
          sendMessage(self, {
            message: `Scanline fill failed: ${(err as any).message}`,
            level: "error",
            task: e.data,
          });
        }

        sendMessage(self, {
          data: result,
          message: "Color search completed",
          level: "result",
          task: e.data,
        });
      } catch (err) {
        sendMessage(self, {
          message: `Color search failed: ${err}`,
          level: "error",
          task: e.data,
        });
      }
      break;

    default:
      sendMessage(self, {
        message: `Unknown task type: ${e.data.type}`,
        level: "error",
        task: e.data,
      });
  }
};
