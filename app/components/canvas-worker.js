const getAllCoordinatesOfColor = (ctx, width, height, hexColor) => {
  try {
    const coordinates = [];
    const imageData = ctx.getImageData(0, 0, width, height);

    /*    self.postMessage({
      type: "log",
      message: `got imageData: ${JSON.stringify(imageData.data.slice(0, 200))}`,
    }); */

    const rTarget = parseInt(hexColor.slice(0, 2), 16);
    const gTarget = parseInt(hexColor.slice(2, 4), 16);
    const bTarget = parseInt(hexColor.slice(4, 6), 16);

    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const index = (y * imageData.width + x) * 4;
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];

        if (r === rTarget && g === gTarget && b === bTarget) {
          coordinates.push({ x, y });
        }
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
  self.postMessage({
    type: "log",
    message: `worker got event: ${JSON.stringify(e.data)}`,
  });
  switch (e.data.type) {
    case "init":
      try {
        canvasCtx = e.data.canvas.getContext("2d", {
          willReadFrequently: true,
        });
        self.postMessage({
          type: "log",
          message: "worker initialized with canvas",
        });
      } catch (e) {
        self.postMessage({
          type: "log",
          message: `something went wrong during canvas init: ${JSON.stringify(
            e
          )}`,
        });
      }

      break;
    case "drawImage":
      try {
        canvasCtx.drawImage(e.data.imageBitmap, 0, 0);
        self.postMessage({
          type: "log",
          message: "worker drew image on canvas",
        });
      } catch (e) {
        self.postMessage({
          type: "log",
          message: `something went wrong during canvas bitmap drawing: ${JSON.stringify(
            e
          )}`,
        });
      }
      break;
    case "task":
      self.postMessage({
        type: "log",
        message: "worker got task",
      });
      const coordinates = getAllCoordinatesOfColor(
        canvasCtx,
        e.data.canvasWidth,
        e.data.canvasHeight,
        e.data.colorHex
      );
      self.postMessage({
        type: "result",
        coordinates: coordinates,
        colorHex: e.data.colorHex,
      });
  }
  /*   const canvas = e.data.canvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const coordinates = getAllCoordinatesOfColor(canvas, e.data.hexColor);

  console.log("coordinates computed in worker:", coordinates); */
};
