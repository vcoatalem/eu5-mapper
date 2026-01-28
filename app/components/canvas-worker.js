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

let pixelData32; // Uint32Array for fast pixel access
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

        // Receive ArrayBuffer and wrap in Uint8ClampedArray
        const pixelDataBuffer = e.data.pixelDataBuffer;
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
          message: `something went wrong during worker init: ${err.message}`,
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

        // Convert hex to 32-bit color (ABGR format for little-endian)
        const r = parseInt(e.data.colorHex.slice(0, 2), 16);
        const g = parseInt(e.data.colorHex.slice(2, 4), 16);
        const b = parseInt(e.data.colorHex.slice(4, 6), 16);
        const targetColor32 = (b << 16) | (g << 8) | r;

        const coordinates = getAllCoordinatesOfColor(
          pixelData32,
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
