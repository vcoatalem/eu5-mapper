const getAllCoordinatesOfColor = (ctx, width, height, hexColor) => {
  try {
    const coordinates = [];
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data; // Cache array reference
    const len = data.length;

    const rTarget = parseInt(hexColor.slice(0, 2), 16);
    const gTarget = parseInt(hexColor.slice(2, 4), 16);
    const bTarget = parseInt(hexColor.slice(4, 6), 16);

    // Direct array iteration is faster than nested loops
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r === rTarget && g === gTarget && b === bTarget) {
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        coordinates.push({ x, y });
      }
    }

    return coordinates;
  } catch (e) {
    self.postMessage({
      type: "log",
      message: `something went wrong while executing getAllCoordinatesOfColor - ${e}`,
    });
  }
};

let canvasCtx;

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
        // Create a new OffscreenCanvas for this worker
        const canvas = new OffscreenCanvas(
          e.data.canvasWidth,
          e.data.canvasHeight
        );
        canvasCtx = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        // Draw the image bitmap onto the canvas
        canvasCtx.drawImage(e.data.imageBitmap, 0, 0);

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
        if (!canvasCtx) {
          throw new Error(
            "Canvas context not initialized. Must call 'init' first."
          );
        }

        self.postMessage({
          type: "log",
          message: "worker processing color search task",
          taskId: taskId,
        });

        const coordinates = getAllCoordinatesOfColor(
          canvasCtx,
          e.data.canvasWidth,
          e.data.canvasHeight,
          e.data.colorHex
        );

        self.postMessage({
          type: "result",
          taskId: taskId,
          data: {
            coordinates: coordinates,
            colorHex: e.data.colorHex,
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
