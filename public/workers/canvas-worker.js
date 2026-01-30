"use strict";
(() => {
  // workers/utils.ts
  var sendMessage = (self2, payload) => {
    const workerMessage = {
      type: payload.level,
      taskType: payload.task.type,
      taskId: payload.task.id,
      message: payload.message ? `[${globalThis.__workerName}] ${payload.message}` : ""
    };
    if (payload.data !== void 0) {
      workerMessage.data = payload.data;
    }
    self2.postMessage(workerMessage);
  };

  // workers/canvas-worker.ts
  globalThis.__workerName = "Canvas Worker";
  var scanlineFill = (data32, width, startX, startY, task) => {
    const height = data32.length / width;
    const visited = new Uint8Array(data32.length);
    const x = Math.floor(startX);
    const y = Math.floor(startY);
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return [];
    }
    const startIdx = y * width + x;
    const targetColor32 = data32[startIdx] & 16777215;
    const coords = [];
    const stack = [[x, y]];
    const maxIterations = width * height;
    let iterations = 0;
    const neighbors = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];
    while (stack.length > 0 && iterations < maxIterations) {
      iterations++;
      const popped = stack.pop();
      if (!popped)
        continue;
      const [cx, cy] = popped;
      const idx = cy * width + cx;
      if (visited[idx])
        continue;
      const currentColor = data32[idx] & 16777215;
      if (currentColor !== targetColor32)
        continue;
      visited[idx] = 1;
      coords.push({ x: cx, y: cy });
      for (const [dx, dy] of neighbors) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height)
          continue;
        const neighborIdx = ny * width + nx;
        if (!visited[neighborIdx] && (data32[neighborIdx] & 16777215) === targetColor32) {
          stack.push([nx, ny]);
        }
      }
    }
    if (iterations >= maxIterations) {
      sendMessage(self, {
        level: "log",
        message: `scanlineFill hit max iterations: ${maxIterations}, stack: ${stack.length}, coords: ${coords.length}`,
        task,
        data: null
      });
      self.postMessage({});
    }
    return coords;
  };
  var pixelData32;
  var canvasWidth;
  var canvasHeight;
  self.onmessage = function(e) {
    sendMessage(self, {
      data: null,
      message: `Received task: ${JSON.stringify(e.data).substring(0, 100)}...`,
      level: "log",
      task: e.data
    });
    switch (e.data.type) {
      case "initWithImage":
        try {
          const payload = e.data.payload;
          canvasWidth = payload.canvasWidth;
          canvasHeight = payload.canvasHeight;
          const pixelDataBuffer = payload.pixelDataBuffer;
          const pixelData8 = new Uint8ClampedArray(pixelDataBuffer);
          pixelData32 = new Uint32Array(pixelData8.buffer);
          sendMessage(self, {
            data: {
              success: true,
              message: "Worker initialized with pixel data"
            },
            message: "Worker initialized with pixel data",
            level: "result",
            task: e.data
          });
        } catch (err) {
          sendMessage(self, {
            data: null,
            message: `something went wrong during worker init: ${err.message}`,
            level: "error",
            task: e.data
          });
        }
        break;
      case "colorSearch":
        try {
          if (!pixelData32) {
            throw new Error(
              "Image data not initialized. Must call 'initWithImage' first."
            );
          }
          const payload = e.data.payload;
          if (payload.startCoordinates?.x && payload.startCoordinates?.y) {
            try {
              const coordinates = scanlineFill(
                pixelData32,
                canvasWidth,
                payload.startCoordinates.x,
                payload.startCoordinates.y,
                e.data
              );
              const result = {
                coordinates,
                locationName: payload.locationName
              };
              sendMessage(self, {
                data: result,
                message: "Color search completed",
                level: "result",
                task: e.data
              });
            } catch (err) {
              sendMessage(self, {
                message: `Scanline fill failed: ${err.message}`,
                level: "error",
                task: e.data
              });
            }
          } else {
            throw new Error("Invalid color search payload");
          }
        } catch (err) {
          sendMessage(self, {
            message: `Color search failed: ${err}`,
            level: "error",
            task: e.data
          });
        }
        break;
      default:
        sendMessage(self, {
          message: `Unknown task type: ${e.data.type}`,
          level: "error",
          task: e.data
        });
    }
  };
})();
