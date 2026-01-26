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

let canvasCtx;
let cachedImageData32;
let canvasWidth;
let canvasHeight;

self.onmessage = function (e) {
  const taskId = e.data.taskId;

  self.postMessage({
    type: "log",
    message: `worker got event: ${JSON.stringify(e.data)}`,
    taskId: taskId,
  });

  switch (e.data.type) {
    case "initWithImage":
      try {
        canvasWidth = e.data.canvasWidth;
        canvasHeight = e.data.canvasHeight;

        // Create a new OffscreenCanvas for this worker
        const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
        canvasCtx = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        // Draw the image bitmap onto the canvas
        canvasCtx.drawImage(e.data.imageBitmap, 0, 0);

        // Cache image data as Uint32Array for faster access (4 bytes at once)
        const imageData = canvasCtx.getImageData(
          0,
          0,
          canvasWidth,
          canvasHeight
        );
        cachedImageData32 = new Uint32Array(imageData.data.buffer);

        self.postMessage({
          type: "log",
          message: "worker initialized with image",
          taskId: taskId,
        });
        self.postMessage({
          type: "result",
          taskId: taskId,
          data: { success: true, message: "Canvas initialized with image" },
        });
      } catch (err) {
        self.postMessage({
          type: "error",
          taskId: taskId,
          message: `something went wrong during canvas init with image: ${err.message}`,
        });
      }
      break;

    case "colorSearch":
      try {
        if (!cachedImageData32) {
          throw new Error(
            "Image data not initialized. Must call 'initWithImage' first."
          );
        }

        self.postMessage({
          type: "log",
          message: "worker processing color search task",
          taskId: taskId,
        });

        // Convert hex to 32-bit color (ABGR format for little-endian)
        const r = parseInt(e.data.colorHex.slice(0, 2), 16);
        const g = parseInt(e.data.colorHex.slice(2, 4), 16);
        const b = parseInt(e.data.colorHex.slice(4, 6), 16);
        const targetColor32 = (b << 16) | (g << 8) | r;

        const coordinates = getAllCoordinatesOfColor(
          cachedImageData32,
          canvasWidth,
          targetColor32
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
