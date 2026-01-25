import {
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { InfoBoxComponent } from "./infoBox.component";
import { AppContext, ILocation } from "../app-context-provider";

const mapInfos = {
  width: 16384,
  height: 8192,
  colorMapFileName: "test/locations.png",
  borderMapFileName: "test/border_layer.png",
  waterMapFileName: "test/water_layer.png",
  blackBackgroundFileName: "test/black_layer.png",
};

export function WorldMapComponent() {
  const { setSelectedLocation, mappingData } = useContext(AppContext);
  if (!setSelectedLocation || !mappingData) {
    throw new Error("context is not set up properly");
  }

  const isDraggingRef = useRef(false);
  const initializedRef = useRef(false);
  const clickedOnLocationRef = useRef<ILocation | null>(null);
  const zoomRef = useRef(1);
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterCanvasRef = useRef<HTMLCanvasElement>(null);
  const blackCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const topLayerRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker>(null);
  const [, forceUpdate] = useState({});

  const initializeWorkerAndCanvas = (): Worker => {
    const worker = new Worker(new URL("canvas-worker.js", import.meta.url));
    const workerCanvas = new OffscreenCanvas(mapInfos.width, mapInfos.height);
    worker.postMessage({ type: "init", canvas: workerCanvas }, [workerCanvas]);
    worker.addEventListener("message", (event) => {
      switch (event.data.type) {
        case "log":
          console.log("[WORKER] ", event.data.message);
          break;
        case "result":
          console.log("[WORKER RESULT] ", event.data.message);
          drawCoordinates(event.data.message);
          break;
      }
    });
    return worker;
  };

  const createBlackCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, mapInfos.width, mapInfos.height);
  };

  const createTransparentCanvas = (ctx: CanvasRenderingContext2D) => {
    // by default, canvas is transparent
    return;
  };

  const layers: Array<{
    ref: RefObject<HTMLCanvasElement | null>;
    zIndex: number;
    path?: string;
    createMethod?: (ctx: CanvasRenderingContext2D) => unknown;
    initializeWorkerCanvas?: boolean;
  }> = [
    {
      ref: colorCanvasRef,
      zIndex: 0,
      path: mapInfos.colorMapFileName,
      initializeWorkerCanvas: true,
    },
    {
      ref: borderCanvasRef,
      zIndex: 5,
      path: mapInfos.borderMapFileName,
    },
    {
      ref: waterCanvasRef,
      zIndex: 3,
      path: mapInfos.waterMapFileName,
    },
    {
      ref: blackCanvasRef,
      zIndex: 1,
      createMethod: createBlackCanvas,
    },
    {
      ref: drawingCanvasRef,
      zIndex: 6,
      createMethod: createTransparentCanvas,
    },
  ];

  const triggerRender = useCallback(() => {
    forceUpdate({});
  }, []);

  const searchLocationOnMouse = useCallback(
    (
      colorCanvas: HTMLCanvasElement,
      mapping: Record<string, string>,
      event: MouseEvent
    ) => {
      const zoom = zoomRef.current;
      const rect = colorCanvas.getBoundingClientRect();

      // Get click position in screen coordinates
      const clickScreenX = event.clientX;
      const clickScreenY = event.clientY;

      // Get canvas position in screen coordinates
      const canvasScreenLeft = rect.left;
      const canvasScreenTop = rect.top;

      // Calculate position relative to canvas's rendered position
      const relX = clickScreenX - canvasScreenLeft;
      const relY = clickScreenY - canvasScreenTop;

      // Convert from rendered (zoomed) coordinates back to original image coordinates
      // The canvas is scaled at origin 0,0, so we need to account for the CSS positioning
      const imageX = relX / zoom;
      const imageY = relY / zoom;

      const imageData = colorCanvas
        .getContext("2d", { willReadFrequently: true })
        ?.getImageData(imageX, imageY, 1, 1);

      console.log("imageData", imageData);

      if (!imageData) {
        console.log("no image data at coordinates", {
          imageX,
          imageY,
          relX,
          relY,
          zoom,
        });
        return;
      }
      const [r, g, b] = [
        parseInt(`${imageData.data[0]}`),
        parseInt(`${imageData.data[1]}`),
        parseInt(`${imageData.data[2]}`),
      ];

      const hexStr = [
        r.toString(16).padStart(2, "0"),
        g.toString(16).padStart(2, "0"),
        b.toString(16).padStart(2, "0"),
      ].join("");

      const locationName = mapping[hexStr] || "??";
      if (locationName === "??") {
        console.log("could not find hex code for color", hexStr);
      }
      console.log("set clicked on location", locationName, {
        imageX,
        imageY,
        hexStr,
      });
      clickedOnLocationRef.current = { name: locationName, colorHex: hexStr };
    },
    []
  );

  const setInitialPosition = useCallback(() => {
    // Position user at coordinates X: 7934, Y: 1991
    const colorCanvas = colorCanvasRef.current;
    const borderCanvas = borderCanvasRef.current;
    const container = containerRef.current;

    if (!colorCanvas || !borderCanvas || !container) return;

    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const targetX = 7934;
    const targetY = 1991;
    const zoom = zoomRef.current;

    const newLeft = centerX - targetX * zoom;
    const newTop = centerY - targetY * zoom;

    layers.forEach((layer) => {
      const canvas = layer.ref.current;
      if (canvas) {
        canvas.style.left = newLeft + "px";
        canvas.style.top = newTop + "px";
      }
    });
  }, []);

  const drawCoordinates = useCallback(
    (coordinates: Array<{ x: number; y: number }>) => {
      console.log("enter drawCoordinates with coordinates:", coordinates);
      const drawingCtx = drawingCanvasRef.current?.getContext("2d");

      coordinates.forEach(({ x, y }) => {
        const newPixelData = drawingCtx?.createImageData(1, 1);
        if (!newPixelData) {
          throw new Error("could not create image data on drawing context");
        }
        const [r, g, b, alpha] = [255, 255, 255, 255];
        newPixelData.data[0] = r;
        newPixelData.data[1] = g;
        newPixelData.data[2] = b;
        newPixelData.data[3] = alpha;
        drawingCtx?.putImageData(newPixelData, x, y);
        console.log("put image data done");
      });
    },
    [drawingCanvasRef]
  );

  useEffect(() => {
    console.log("enter useEffect for setup worldmap component");

    if (initializedRef.current) {
      console.log("worldmap component already initialized, skipping");
      return;
    }

    workerRef.current = initializeWorkerAndCanvas();

    const colorCanvas = colorCanvasRef.current;
    const borderCanvas = borderCanvasRef.current;
    const container = containerRef.current;

    if (!colorCanvas || !borderCanvas || !container || !mappingData) return;

    const colorContext = colorCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    const borderContext = borderCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!colorContext || !borderContext) {
      console.log("canvas context is nullish");
      return;
    }

    // effect variables: these will only be used inside this effect until destruction
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let dragDistance = 0;
    const MIN_DRAG_DISTANCE = 5;

    layers.forEach((layer) => {
      const img = new Image();
      const ctx = layer.ref.current?.getContext("2d");
      if (!ctx) {
        console.log("could not get layer ref context");
        return;
      }
      if (layer.path) {
        img.src = layer.path;
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          if (layer.initializeWorkerCanvas && workerRef.current) {
            createImageBitmap(colorCanvas).then((bitmap) => {
              workerRef.current.postMessage({
                type: "drawImage",
                imageBitmap: bitmap,
              });
            });
          }
        };
      } else if (layer.createMethod) {
        layer.createMethod(ctx);
      } else {
        console.log(
          "layer needs to have either a path (file) or createMethod specified"
        );
      }

      // TODO: remove loading screen only after all canvas have loaded
    });

    const topLayer = layers.sort((a, b) => b.zIndex - a.zIndex)[0];
    if (topLayer.ref.current) {
      topLayerRef.current = topLayer.ref.current;
    } else {
      throw new Error("could not set top layer ref");
    }

    const handleMouseDown = (e: MouseEvent) => {
      console.log("mousedown");
      isDraggingRef.current = true;
      triggerRender();
      dragDistance = 0;
      startX = e.clientX;
      startY = e.clientY;
      const rect = colorCanvas.getBoundingClientRect();
      scrollLeft = rect.left;
      scrollTop = rect.top;
      searchLocationOnMouse(colorCanvas, mappingData, e);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();

      const x = e.clientX - startX;
      const y = e.clientY - startY;
      dragDistance = Math.sqrt(x * x + y * y);
      if (dragDistance > MIN_DRAG_DISTANCE) {
        setSelectedLocation(null);
      }

      layers.forEach((layer) => {
        const canvas = layer.ref.current;
        if (canvas) {
          canvas.style.left = scrollLeft + x + "px";
          canvas.style.top = scrollTop + y + "px";
        }
      });
    };

    const handleMouseUp = () => {
      console.log("handleMouseUp");
      if (
        dragDistance < MIN_DRAG_DISTANCE &&
        clickedOnLocationRef.current?.name
      ) {
        setSelectedLocation(clickedOnLocationRef.current);
        if (workerRef.current) {
          workerRef.current.postMessage({
            type: "task",
            canvasWidth: colorCanvas.width,
            canvasHeight: colorCanvas.height,
            colorHex: clickedOnLocationRef.current?.colorHex,
          });
        }
      }
      isDraggingRef.current = false;
      triggerRender();
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      triggerRender();
    };

    console.log({ topLayerRefForCreate: topLayerRef });
    if (topLayerRef.current) {
      console.log("add mouse event listeners");
      topLayerRef.current.addEventListener("mousedown", handleMouseDown);
      topLayerRef.current.addEventListener("mousemove", handleMouseMove);
      topLayerRef.current.addEventListener("mouseup", handleMouseUp);
      topLayerRef.current.addEventListener("mouseleave", handleMouseLeave);
    }

    setInitialPosition();
    initializedRef.current = true;

    return () => {
      console.log({ topLayerRefForDestroy: topLayerRef });
      if (topLayerRef.current) {
        console.log("remove mouse event listeners");
        topLayerRef.current.removeEventListener("mousedown", handleMouseDown);
        topLayerRef.current.removeEventListener("mousemove", handleMouseMove);
        topLayerRef.current.removeEventListener("mouseup", handleMouseUp);
        topLayerRef.current.removeEventListener("mouseleave", handleMouseLeave);
      }
      workerRef.current?.terminate();
      initializedRef.current = false;
    };
  }, [mappingData]);

  const applyZoomLevel = (newZoom: number) => {
    const colorCanvas = colorCanvasRef.current;
    const borderCanvas = borderCanvasRef.current;
    const container = containerRef.current;
    const waterCanvas = waterCanvasRef.current;

    if (!colorCanvas || !borderCanvas || !waterCanvas || !container) return;

    const containerRect = container.getBoundingClientRect();

    // Calculate center of viewport
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    // Get current position and zoom
    const currentLeft = parseFloat(colorCanvas.style.left) || 0;
    const currentTop = parseFloat(colorCanvas.style.top) || 0;
    const oldZoom = zoomRef.current;

    // Calculate the point on the canvas that's at the center of the viewport
    const canvasCenterX = (centerX - currentLeft) / oldZoom;
    const canvasCenterY = (centerY - currentTop) / oldZoom;

    // Calculate new position so that the same canvas point remains at the viewport center
    const newLeft = centerX - canvasCenterX * newZoom;
    const newTop = centerY - canvasCenterY * newZoom;

    zoomRef.current = newZoom;

    layers.forEach((layer) => {
      const canvas = layer.ref.current;
      if (canvas) {
        canvas.style.transform = `scale(${newZoom})`;
        canvas.style.transformOrigin = "0 0";
        canvas.style.left = newLeft + "px";
        canvas.style.top = newTop + "px";
      }
    });
  };

  const zoomSteps = [0.1, 0.3, 0.7, 1, 1.5, 3, 5];
  const handleZoomOut = (event: React.MouseEvent<HTMLButtonElement>) => {
    console.log("zoom out", event);
    event.preventDefault();
    setSelectedLocation(null);
    //const newZoom = Math.max(0.1, zoomRef.current - 0.1);
    const currentZoom = zoomSteps.indexOf(zoomRef.current);
    const newZoom = zoomSteps[Math.max(0, currentZoom - 1)];
    applyZoomLevel(newZoom);
  };

  const handleZoomIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    console.log("zoom in", event);
    event.preventDefault();
    setSelectedLocation(null);

    const currentZoom = zoomSteps.indexOf(zoomRef.current);
    const newZoom = zoomSteps[Math.min(zoomSteps.length - 1, currentZoom + 1)];
    applyZoomLevel(newZoom);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen"
      style={{
        overflow: "hidden",
        position: "relative",
        cursor: isDraggingRef.current ? "grabbing" : "default",
      }}
    >
      {layers.map((layer) => (
        <canvas
          ref={layer.ref}
          height={mapInfos.height}
          width={mapInfos.width}
          key={layer.zIndex}
          className={"absolute"}
          style={{ zIndex: layer.zIndex, imageRendering: "pixelated" }}
        ></canvas>
      ))}
      <InfoBoxComponent />
      <div className="fixed border-white gap-2 flex flex-row right-5 bottom-5 z-10 text-white">
        <button
          onClick={handleZoomOut}
          className="w-8 border-white border-2 border-radius-md bg-black px-2"
        >
          -
        </button>
        <button
          onClick={handleZoomIn}
          className="w-8 border-white border-2 border-radius-md bg-black px-2"
        >
          +
        </button>
      </div>
    </div>
  );
}
