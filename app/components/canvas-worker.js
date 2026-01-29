const scanlineFill = (data32, width, startX, startY) => {
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
  const coords = [];
  const stack = [[x, y]];
  const maxIterations = width * height;
  let iterations = 0;
  
  // Neighbor offsets: [dx, dy]
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  while (stack.length > 0 && iterations < maxIterations) {
    iterations++;
    const [cx, cy] = stack.pop();
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
      if (!visited[neighborIdx] && (data32[neighborIdx] & 0x00ffffff) === targetColor32) {
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
}


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


        self.postMessage({
          type: "log",
          message: `colorSearch payload: ${JSON.stringify(e.data)}`,
          taskId: taskId,
        })

        if (e.data.colorHex) {
          try {
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
          }
          catch (err) {
            self.postMessage({
              type: "error",
              taskId: taskId,
              message: `Color search failed: ${err.message}`,
            });
          }
        }
        else if (e.data.startCoordinates?.x && e.data.startCoordinates?.y) {
          try {
            const coordinates = scanlineFill(
              pixelData32,
              canvasWidth,
              e.data.startCoordinates.x,
              e.data.startCoordinates.y,
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
              message: `Scanline fill failed: ${err.message}`,
            });
          }
          
        }
        else {
          throw new Error("Invalid color search payload");
        }
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
