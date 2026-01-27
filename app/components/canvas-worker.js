const getAllCoordinatesOfColor = (data32, width, targetColor32) => {
  try {
    const len = data32.length;
    const coordinates = [];

    // Use bitwise operations for faster comparison
    for (let i = 0; i < len; i++) {
      if ((data32[i] & 0x00ffffff) === targetColor32) {
        const x = i % width;
        const y = (i / width) | 0; // Bitwise OR for faster floor
        coordinates.push({ x, y });
      }
    }

    return coordinates;
  } catch (e) {
    self.postMessage({
      type: "log",
      message: `something went wrong while executing getAllCoordinatesOfColor - ${e}`,
    });
    return [];
  }
};

let offscreenCanvas;
let offscreenContext;
let canvasWidth;
let canvasHeight;

self.onmessage = function (e) {
  const taskId = e.data.taskId;

  /*
  const logData = { taskId: e.data.taskId, type: e.data.type };
  if (e.data.canvasWidth) logData.canvasWidth = e.data.canvasWidth;
  if (e.data.canvasHeight) logData.canvasHeight = e.data.canvasHeight;
  if (e.data.colorHex) logData.colorHex = e.data.colorHex;
  if (e.data.locationName) logData.locationName = e.data.locationName;
 
  self.postMessage({
    type: "log",
    message: `worker got event: ${JSON.stringify(logData)}`,
    taskId: taskId,
  }); */

  switch (e.data.type) {
    case "initWithImage":
      try {
        canvasWidth = e.data.canvasWidth;
        canvasHeight = e.data.canvasHeight;
        offscreenCanvas = e.data.canvas;
        offscreenContext = offscreenCanvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (!offscreenContext) {
          throw new Error("Failed to get 2D context from OffscreenCanvas");
        }

        // Draw the ImageBitmap onto the OffscreenCanvas
        if (e.data.imageBitmap) {
          offscreenContext.drawImage(e.data.imageBitmap, 0, 0);
        }

        const pixelCount = canvasWidth * canvasHeight;
        self.postMessage({
          type: "log",
          message: `worker initialized with ${pixelCount} pixels`,
          taskId: taskId,
        });
        self.postMessage({
          type: "result",
          taskId: taskId,
          data: {
            success: true,
            message: "Worker initialized with offscreen canvas",
          },
        });
      } catch (err) {
        self.postMessage({
          type: "error",
          taskId: taskId,
          message: `something went wrong during worker init: ${err.message}`,
        });
      }
      break;

    case "colorSearch":
      try {
        if (!offscreenContext || !offscreenCanvas) {
          throw new Error(
            "Image data not initialized. Must call 'initWithImage' first.",
          );
        }

        self.postMessage({
          type: "log",
          message: "worker processing color search task",
          taskId: taskId,
        });

        // Get image data from OffscreenCanvas
        const imageData = offscreenContext.getImageData(
          0,
          0,
          canvasWidth,
          canvasHeight,
        );
        const imageData32 = new Uint32Array(imageData.data.buffer);

        // Convert hex to 32-bit color (ABGR format for little-endian)
        const r = parseInt(e.data.colorHex.slice(0, 2), 16);
        const g = parseInt(e.data.colorHex.slice(2, 4), 16);
        const b = parseInt(e.data.colorHex.slice(4, 6), 16);
        const targetColor32 = (b << 16) | (g << 8) | r;

        const coordinates = getAllCoordinatesOfColor(
          imageData32,
          canvasWidth,
          targetColor32,
        );

        self.postMessage({
          type: "result",
          taskId: taskId,
          data: {
            coordinates: coordinates,
            locationName: e.data.locationName,
          },
        });
      } catch (err) {
        self.postMessage({
          type: "error",
          taskId: taskId,
          message: `Color search failed: ${err.message}`,
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
