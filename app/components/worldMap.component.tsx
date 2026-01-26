import {
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { InfoBoxComponent } from "./infoBox.component";
import { AppContext } from "../appContextProvider";
import { GameLogicController } from "../lib/gameLogicController";
import { ILocationIdentifier } from "../lib/types";
import { DrawingLogicController } from "../lib/drawingLogicController";
import { WorkerManager } from "../lib/workerManager";
import { IWorkerManagerObserver } from "../lib/workerTypes";
import { LoadingScreenComponent } from "./loadingScreen.component";
import { useGameData } from "../gameDataContext";

const mapInfos = {
  width: 16384,
  height: 8192,
  colorMapFileName: "test/locations.png",
  borderMapFileName: "test/border_layer.png",
  waterMapFileName: "test/water_layer.png",
  riverMapFileName: "test/river_layer.png",
  unownableTerrainMapFileName: "test/unownable_layer.png",
};

export function WorldMapComponent() {
  const { setSelectedLocation, setHoveredLocation } = useContext(AppContext);
  const {
    locationDataMap,
    colorToNameMap,
    error: gameDataLoadingError,
  } = useGameData();

  if (!locationDataMap) {
    throw new Error("gameData is not loaded");
  }

  if (!setSelectedLocation || !setHoveredLocation) {
    throw new Error("context is not set up properly");
  }

  const isDraggingRef = useRef(false);
  const initializedRef = useRef(false);
  const clickedOnLocationRef = useRef<ILocationIdentifier | null>(null);
  const zoomRef = useRef(1);
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterCanvasRef = useRef<HTMLCanvasElement>(null);
  const blackCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const riverCanvasRef = useRef<HTMLCanvasElement>(null);
  const topLayerRef = useRef<HTMLCanvasElement>(null);
  const unownableTerrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerManagerRef = useRef<WorkerManager>(null);
  const gameLogicRef = useRef(
    new GameLogicController(locationDataMap, colorToNameMap)
  );
  const drawingLogicRef = useRef<DrawingLogicController>(null);
  const [, forceUpdate] = useState({});
  const [workerStatus, setWorkerStatus] = useState({
    activeTasks: 0,
    queuedTasks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const layersRenderedRef = useRef(0);
  const totalLayersRef = useRef(0);

  const workerPoolSize = 4;
  const initializeWorkerAndCanvas = (): void => {
    if (workerManagerRef.current) {
      workerManagerRef.current.terminate();
    }

    const workerManager = new WorkerManager(
      new URL("canvas-worker.js", import.meta.url).href,
      workerPoolSize
    );

    // Subscribe to worker status updates
    const observer: IWorkerManagerObserver = {
      onTasksChanged: (activeTasks, queuedTasks) => {
        setWorkerStatus({ activeTasks, queuedTasks });
      },
    };
    workerManager.subscribe(observer);

    workerManagerRef.current = workerManager;
  };

  const waitForInitialization = async (): Promise<void> => {
    try {
      // Wait for all layers to be rendered
      await new Promise<void>((resolve) => {
        const checkLayersRendered = () => {
          if (
            layersRenderedRef.current === totalLayersRef.current &&
            totalLayersRef.current > 0
          ) {
            resolve();
          }
        };

        // Check immediately in case layers are already rendered
        checkLayersRendered();

        // Set up an interval to check periodically
        const interval = setInterval(checkLayersRendered, 50);

        // Cleanup interval after a timeout (e.g., 30 seconds)
        const timeout = setTimeout(() => {
          clearInterval(interval);
          resolve(); // Resolve anyway to prevent infinite loading
        }, 30000);

        return () => {
          clearInterval(interval);
          clearTimeout(timeout);
        };
      });

      setLoadingError(null);
      setIsLoading(false);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Initialization failed";
      setLoadingError(errorMsg);
      setIsLoading(false);
      console.error("[WorldMapComponent] Initialization error:", errorMsg);
    }
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
      zIndex: 10,
      path: mapInfos.borderMapFileName,
    },
    {
      ref: waterCanvasRef,
      zIndex: 6,
      path: mapInfos.waterMapFileName,
    },
    {
      ref: blackCanvasRef,
      zIndex: 1,
      createMethod: createBlackCanvas,
    },
    {
      ref: drawingCanvasRef,
      zIndex: 4,
      createMethod: createTransparentCanvas,
    },
    {
      ref: riverCanvasRef,
      zIndex: 7,
      path: mapInfos.riverMapFileName,
    },
    {
      ref: unownableTerrainCanvasRef,
      zIndex: 5,
      path: mapInfos.unownableTerrainMapFileName,
    },
  ];

  const triggerRender = useCallback(() => {
    forceUpdate({});
  }, []);

  const getLocationAtPointer = useCallback(
    (
      colorCanvas: HTMLCanvasElement,
      event: MouseEvent
    ): ILocationIdentifier | null => {
      const zoom = zoomRef.current;
      const rect = colorCanvas.getBoundingClientRect();

      const relX = event.clientX - rect.left;
      const relY = event.clientY - rect.top;

      const imageX = relX / zoom;
      const imageY = relY / zoom;

      const imageData = colorCanvas
        .getContext("2d", { willReadFrequently: true })
        ?.getImageData(imageX, imageY, 1, 1);

      if (!imageData) {
        return null;
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

      const locationName = gameLogicRef.current.findLocationName(hexStr);
      return locationName;
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

  useEffect(() => {
    console.log("enter useEffect for setup worldmap component");

    if (initializedRef.current) {
      console.log("worldmap component already initialized, skipping");
      return;
    }

    initializeWorkerAndCanvas();
    waitForInitialization();

    const colorCanvas = colorCanvasRef.current;
    const borderCanvas = borderCanvasRef.current;
    const container = containerRef.current;

    if (!colorCanvas || !borderCanvas || !container) return;

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

    // Count all layers that need to be rendered
    totalLayersRef.current = layers.length;
    layersRenderedRef.current = 0;

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
          layersRenderedRef.current++;
          console.log(
            `[Layer Rendered] ${layersRenderedRef.current}/${totalLayersRef.current}`
          );
          if (layer.initializeWorkerCanvas && workerManagerRef.current) {
            createImageBitmap(colorCanvas).then((bitmap) => {
              if (workerManagerRef.current) {
                // Initialize all workers with the image
                for (let i = 0; i < workerPoolSize; i++) {
                  const taskId = `initWithImage-${i}`;
                  workerManagerRef.current.queueTask({
                    id: taskId,
                    type: "initWithImage",
                    payload: {
                      type: "initWithImage",
                      imageBitmap: bitmap,
                      canvasWidth: mapInfos.width,
                      canvasHeight: mapInfos.height,
                    },
                    callbacks: {
                      onSuccess: () => {
                        console.log(`[INIT WITH IMAGE COMPLETE] Worker ${i}`);
                      },
                      onError: (error) => {
                        console.error(
                          `[INIT WITH IMAGE ERROR] Worker ${i}`,
                          error
                        );
                      },
                    },
                  });
                }
              }
            });
          }
        };
      } else if (layer.createMethod) {
        layer.createMethod(ctx);
        layersRenderedRef.current++;
      } else {
        console.log(
          "layer needs to have either a path (file) or createMethod specified"
        );
      }
    });

    const topLayer = layers.sort((a, b) => b.zIndex - a.zIndex)[0];
    if (topLayer.ref.current) {
      topLayerRef.current = topLayer.ref.current;
    } else {
      throw new Error("could not set top layer ref");
    }

    drawingLogicRef.current = new DrawingLogicController(
      drawingCanvasRef.current!,
      { width: mapInfos.width, height: mapInfos.height },
      gameLogicRef.current,
      locationDataMap
    );

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      triggerRender();
      dragDistance = 0;
      startX = e.clientX;
      startY = e.clientY;
      const rect = colorCanvas.getBoundingClientRect();
      scrollLeft = rect.left;
      scrollTop = rect.top;
      const location = getLocationAtPointer(colorCanvas, e);
      clickedOnLocationRef.current = location;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const hoverLocation = getLocationAtPointer(colorCanvas, e);
      setHoveredLocation(hoverLocation);

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
      if (dragDistance < MIN_DRAG_DISTANCE && clickedOnLocationRef.current) {
        setSelectedLocation(clickedOnLocationRef.current);
        gameLogicRef.current.selectLocation(clickedOnLocationRef.current);

        if (workerManagerRef.current) {
          const hexColor =
            locationDataMap[clickedOnLocationRef.current].hexColor;
          const taskId = `colorSearch-${clickedOnLocationRef.current}`;
          workerManagerRef.current.queueTask({
            id: taskId,
            type: "colorSearch",
            payload: {
              type: "colorSearch",
              canvasWidth: colorCanvas.width,
              canvasHeight: colorCanvas.height,
              colorHex: hexColor,
              locationName: clickedOnLocationRef.current,
            },
            callbacks: {
              onSuccess: (result: unknown) => {
                const data = result as {
                  coordinates: Array<{ x: number; y: number }>;
                  locationName: string;
                };
                drawingLogicRef.current?.addCoordinate(
                  data.locationName,
                  data.coordinates
                );
                console.log("[COLOR SEARCH COMPLETE]", data);
              },
              onError: (error) => {
                console.error("[COLOR SEARCH ERROR]", error);
              },
            },
          });
        }
      }
      isDraggingRef.current = false;
      triggerRender();
    };

    const handleMouseLeave = () => {
      isDraggingRef.current = false;
      setHoveredLocation(null);
      triggerRender();
    };

    const handleWheel = (e: WheelEvent) => {
      if (!topLayerRef.current) return;
      e.preventDefault();
      const direction = e.deltaY < 0 ? -1 : 1; // up = zoom out (reversed)
      const currentZoomIndex = zoomSteps.indexOf(zoomRef.current);
      const nextIndex = Math.min(
        Math.max(0, currentZoomIndex + direction),
        zoomSteps.length - 1
      );
      const nextZoom = zoomSteps[nextIndex];
      if (nextZoom !== zoomRef.current) {
        applyZoomLevel(nextZoom);
      }
    };

    console.log({ topLayerRefForCreate: topLayerRef });
    if (topLayerRef.current) {
      console.log("add mouse event listeners");
      topLayerRef.current.addEventListener("mousedown", handleMouseDown);
      topLayerRef.current.addEventListener("mousemove", handleMouseMove);
      topLayerRef.current.addEventListener("mouseup", handleMouseUp);
      topLayerRef.current.addEventListener("mouseleave", handleMouseLeave);
      topLayerRef.current.addEventListener("wheel", handleWheel, {
        passive: false,
      });
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
        topLayerRef.current.removeEventListener("wheel", handleWheel);
      }
      workerManagerRef.current?.terminate();
      initializedRef.current = false;
    };
  }, []);

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
      {gameDataLoadingError ? (
        <LoadingScreenComponent message={gameDataLoadingError} />
      ) : (
        layers.map((layer) => (
          <canvas
            ref={layer.ref}
            height={mapInfos.height}
            width={mapInfos.width}
            key={layer.zIndex}
            className={"absolute"}
            style={{ zIndex: layer.zIndex, imageRendering: "pixelated" }}
          ></canvas>
        ))
      )}
      {isLoading ? (
        <LoadingScreenComponent
          message={loadingError ? `Error: ${loadingError}` : "Loading..."}
        />
      ) : (
        <>
          <InfoBoxComponent />
          <div className="fixed border-white gap-2 flex flex-col right-5 bottom-5 z-10 text-white">
            <div className="text-sm bg-black px-2 py-1 border border-white border-radius-md">
              <div>Tasks: {workerStatus.activeTasks} active</div>
              <div>Queue: {workerStatus.queuedTasks}</div>
            </div>
            <div className="flex flex-row gap-2">
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
        </>
      )}
    </div>
  );
}
