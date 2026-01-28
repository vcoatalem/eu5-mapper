import {
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "../styles/Gui.module.css";
import { InfoBoxComponent } from "./infoBox.component";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "@/app/lib/gameStateController";
import { ILocationIdentifier } from "../lib/types/general";
import { DrawingLogicController } from "@/app/lib/drawingLogicController";
import { workerManager } from "@/app/lib/workerManager";
import { LoadingScreenComponent } from "./loadingScreen.component";
import { ZoomController } from "@/app/lib/zoomController";
import { WorkerStatusComponent } from "./workerStatus.component";

const mapInfos = {
  width: 16384,
  height: 8192,
  colorMapFileName: "test/locations.png",
  borderMapFileName: "test/border_layer.png",
  terrainLayerFileName: "test/terrain_layer.png",
  riverMapFileName: "test/river_layer.png",
};

export function WorldMapComponent() {
  const {
    setSelectedLocation,
    setHoveredLocation,
    gameData,
    isLoading: gameDataLoading,
    error: gameDataLoadingError,
    adjacencyGraph,
  } = useContext(AppContext);

  const isDraggingRef = useRef(false);
  const initializedRef = useRef(false);
  const clickedOnLocationRef = useRef<ILocationIdentifier | null>(null);
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const blackCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const areaDrawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const topLayerRef = useRef<HTMLCanvasElement>(null);
  const constructibleCanvasRef = useRef<HTMLCanvasElement>(null); //TODO: hide this canvas when zoom level is low
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingLogicRef = useRef<DrawingLogicController>(null);
  const zoomControllerRef = useRef<ZoomController>(new ZoomController());
  const [, forceUpdate] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const layersRenderedRef = useRef(0);
  const totalLayersRef = useRef(0);

  const workerPoolSize = 4;
  const initializeWorkerAndCanvas = (): void => {
    workerManager.terminate();
    workerManager.init(
      new URL("canvas-worker.js", import.meta.url).href,
      workerPoolSize,
    );
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
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, 0, mapInfos.width, mapInfos.height);
  };

  const createTransparentCanvas = (ctx: CanvasRenderingContext2D) => {
    // by default, canvas is transparent
    return;
  };

  const layers: Array<{
    name: string;
    ref: RefObject<HTMLCanvasElement | null>;
    zIndex: number;
    path?: string;
    createMethod?: (ctx: CanvasRenderingContext2D) => unknown;
    initializeWorkerCanvas?: boolean;
  }> = [
    {
      name: "colorLayer",
      ref: colorCanvasRef,
      zIndex: 0,
      path: mapInfos.colorMapFileName,
      initializeWorkerCanvas: true,
    },
    {
      name: "blackLayer",
      ref: blackCanvasRef,
      zIndex: 1,
      createMethod: createBlackCanvas,
    },
    {
      name: "borderLayer",
      ref: borderCanvasRef,
      zIndex: 6,
      path: mapInfos.borderMapFileName,
    },
    {
      name: "areaDrawingLayer",
      ref: areaDrawingCanvasRef,
      zIndex: 4,
      createMethod: createTransparentCanvas,
    },
    {
      name: "terrainLayer",
      ref: terrainCanvasRef,
      zIndex: 5,
      path: mapInfos.terrainLayerFileName,
    },
    {
      name: "constructibleLayer",
      ref: constructibleCanvasRef,
      zIndex: 12,
      createMethod: createTransparentCanvas,
    },
  ];

  const triggerRender = useCallback(() => {
    forceUpdate({});
  }, []);

  useEffect(() => {
    console.log("enter useEffect for setup worldmap component");

    if (!gameData) {
      return;
    }

    if (initializedRef.current) {
      console.log("worldmap component already initialized, skipping");
      return;
    }

    initializeWorkerAndCanvas();
    waitForInitialization();

    const colorCanvas = colorCanvasRef.current;
    const container = containerRef.current;

    if (!colorCanvas || !container) return;

    const colorContext = colorCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!colorContext) {
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

    const getLocationAtPointer = (
      colorCanvas: HTMLCanvasElement,
      event: MouseEvent,
    ): ILocationIdentifier | null => {
      const rect = colorCanvas.getBoundingClientRect();

      const relX = event.clientX - rect.left;
      const relY = event.clientY - rect.top;

      const imageX = relX / zoomControllerRef.current.getSnapshot().zoomLevel;
      const imageY = relY / zoomControllerRef.current.getSnapshot().zoomLevel;

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

      const locationName = gameStateController.findLocationName(hexStr) ?? null;
      return locationName;
    };

    const setInitialPosition = () => {
      // Position user at coordinates X: 7934, Y: 1991
      if (!colorCanvas || !container) return;

      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      const targetX = 7934;
      const targetY = 1991;

      const newLeft =
        centerX - targetX * zoomControllerRef.current.getSnapshot().zoomLevel;
      const newTop =
        centerY - targetY * zoomControllerRef.current.getSnapshot().zoomLevel;

      layers.forEach((layer) => {
        const canvas = layer.ref.current;
        if (canvas) {
          canvas.style.left = newLeft + "px";
          canvas.style.top = newTop + "px";
        }
      });
    };

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
          console.log(`[WorldMapInit] loaded image for layer ${layer.name}`);
          ctx.drawImage(img, 0, 0);
          layersRenderedRef.current++;
          console.log(
            `[WorldMapInit] initialized layer ${layer.name}. Total progress: ${layersRenderedRef.current}/${totalLayersRef.current}`,
          );
          if (layer.initializeWorkerCanvas) {
            const imageData = ctx.getImageData(
              0,
              0,
              mapInfos.width,
              mapInfos.height,
            );

            for (let i = 0; i < workerPoolSize; i++) {
              const taskId = `initWithImage-${i}`;
              const pixelDataCopy = new Uint8ClampedArray(imageData.data);
              workerManager.queueTask({
                id: taskId,
                type: "initWithImage",
                payload: {
                  type: "initWithImage",
                  pixelDataBuffer: pixelDataCopy.buffer,
                  canvasWidth: mapInfos.width,
                  canvasHeight: mapInfos.height,
                },
              });
            }
          }
        };
      } else if (layer.createMethod) {
        layer.createMethod(ctx);
        layersRenderedRef.current++;
        console.log(
          `[WorldMapInit] initialized layer ${layer.name}. Total progress: ${layersRenderedRef.current}/${totalLayersRef.current}`,
        );
      } else {
        console.error(
          "[WorldMapInit] layer needs to have either a path (file) or createMethod specified",
        );
      }
    });

    const topLayer = layers.sort((a, b) => b.zIndex - a.zIndex)[0];
    if (topLayer.ref.current) {
      topLayerRef.current = topLayer.ref.current;
    } else {
      throw new Error("could not set top layer ref");
    }

    gameStateController.init(gameData);

    drawingLogicRef.current = new DrawingLogicController(
      areaDrawingCanvasRef.current!,
      constructibleCanvasRef.current!,
      { width: mapInfos.width, height: mapInfos.height },
      gameData,
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
      if (dragDistance < MIN_DRAG_DISTANCE && clickedOnLocationRef.current) {
        console.log({
          clickedLocation:
            gameData.locationDataMap[clickedOnLocationRef.current],
        });

        const reachable = adjacencyGraph?.reachableWithinCost(
          clickedOnLocationRef.current,
          100,
          gameStateController.proximityCostFunction,
        );

        console.log({ reachable });

        if (gameData.locationDataMap[clickedOnLocationRef.current].ownable) {
          setSelectedLocation(clickedOnLocationRef.current);
          gameStateController.selectLocation(clickedOnLocationRef.current);
          const hexColor =
            gameData.locationDataMap[clickedOnLocationRef.current].hexColor;
          const taskId = `colorSearch-${clickedOnLocationRef.current}`;
          workerManager.queueTask({
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
                  data.coordinates,
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
      if (e.deltaY < 0) {
        zoomControllerRef.current.zoomOut();
      } else {
        zoomControllerRef.current.zoomIn();
      }
    };

    zoomControllerRef.current.subscribe(({ zoomLevel, oldZoomLevel }) => {
      applyZoomLevel(zoomLevel, oldZoomLevel);

      if (zoomLevel < 1 && oldZoomLevel >= 1) {
        borderCanvasRef.current!.style.visibility = "hidden";
      } else if (zoomLevel >= 1 && oldZoomLevel < 1) {
        borderCanvasRef.current!.style.visibility = "visible";
      }
    });

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
      workerManager.terminate();
      initializedRef.current = false;
    };
  }, [gameData]);

  const applyZoomLevel = (newZoom: number, oldZoom: number) => {
    const colorCanvas = colorCanvasRef.current;
    const container = containerRef.current;

    if (!colorCanvas || !container) return;

    const containerRect = container.getBoundingClientRect();

    // Calculate center of viewport
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    // Get current position and zoom
    const currentLeft = parseFloat(colorCanvas.style.left) || 0;
    const currentTop = parseFloat(colorCanvas.style.top) || 0;

    // Calculate the point on the canvas that's at the center of the viewport
    const canvasCenterX = (centerX - currentLeft) / oldZoom;
    const canvasCenterY = (centerY - currentTop) / oldZoom;

    // Calculate new position so that the same canvas point remains at the viewport center
    const newLeft = centerX - canvasCenterX * newZoom;
    const newTop = centerY - canvasCenterY * newZoom;

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

  const handleZoomOut = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelectedLocation(null);
    zoomControllerRef.current.zoomOut();
  };

  const handleZoomIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelectedLocation(null);
    zoomControllerRef.current.zoomIn();
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
            style={{
              zIndex: layer.zIndex,
              imageRendering: "pixelated",
            }}
          ></canvas>
        ))
      )}
      {isLoading ? (
        <LoadingScreenComponent
          message={loadingError ? `Error: ${loadingError}` : "Loading..."}
        />
      ) : (
        <div>
          <InfoBoxComponent />
          <div
            className={`${styles.guiElement} fixed border-white gap-2 flex flex-col right-5 bottom-5 text-white`}
          >
            <WorkerStatusComponent />
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
        </div>
      )}
    </div>
  );
}
