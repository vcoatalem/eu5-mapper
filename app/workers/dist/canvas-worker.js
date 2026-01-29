"use strict";
(() => {
  const scanlineFill = (data32, width, startX, startY) => {
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
      self.postMessage({
        type: "log",
        message: `scanlineFill hit max iterations: ${maxIterations}, stack: ${stack.length}, coords: ${coords.length}`
      });
    }
    return coords;
  };
  let pixelData32;
  let canvasWidth;
  let canvasHeight;
  self.onmessage = function(e) {
    const taskId = e.data.id;
    switch (e.data.type) {
      case "initWithImage":
        try {
          const payload = e.data.payload;
          canvasWidth = payload.canvasWidth;
          canvasHeight = payload.canvasHeight;
          const pixelDataBuffer = payload.pixelDataBuffer;
          const pixelData8 = new Uint8ClampedArray(pixelDataBuffer);
          pixelData32 = new Uint32Array(pixelData8.buffer);
          self.postMessage({
            type: "result",
            taskId,
            data: {
              success: true,
              message: "Worker initialized with pixel data"
            }
          });
        } catch (err) {
          self.postMessage({
            type: "error",
            taskId,
            message: `something went wrong during worker init: ${err.message}`
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
                payload.startCoordinates.y
              );
              self.postMessage({
                type: "result",
                taskId,
                data: {
                  coordinates,
                  locationName: payload.locationName
                }
              });
            } catch (err) {
              self.postMessage({
                type: "error",
                taskId,
                message: `Scanline fill failed: ${err.message}`
              });
            }
          } else {
            throw new Error("Invalid color search payload");
          }
        } catch (err) {
          self.postMessage({
            type: "error",
            taskId,
            message: `Color search failed: ${err}`
          });
        }
        break;
      default:
        self.postMessage({
          type: "error",
          taskId,
          message: `Unknown task type: ${e.data.type}`
        });
    }
  };
})();
