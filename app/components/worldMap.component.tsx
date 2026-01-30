import {
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { InfoBoxComponent } from "./infoBox.component";
import { AppContext } from "../appContextProvider";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ILocationIdentifier } from "../lib/types/general";
import { DrawingService } from "@/app/lib/drawing.service";
import { workerManager } from "@/app/lib/workerManager";
import { LoadingScreenComponent } from "./loadingScreen.component";
import { ZoomController } from "@/app/lib/zoomController";
import { WorkerStatusComponent } from "./workerStatus.component";
import { proximityComputationController } from "@/app/lib/proximityComputation.controller";
import { ConstructibleMenusComponent } from "./constructibleMenus.component";
import { GuiElement } from "./guiElement";
import { workerManagerConfig } from "../lib/workerManager.config";
import { worldMapConfig } from "./worldMap.config";
import { neighborsProximityComputationController } from "../lib/neighborsProximityComputation.controller";
import { NeighborsPanelComponent } from "./neighborsPanel.component";

// TODO:
// 1. add building construction
// 2. add "local proximity" sources in pathfinding logic

// check new static data file. see if dev numbers make sense (new river calculation)

export function WorldMapComponent() {
  const context = useContext(AppContext);
  const {
    hoveredLocation,
    setSelectedLocation,
    setHoveredLocation,
    gameData,
    error: gameDataLoadingError,
  } = context;

  /* console.log("render worldmap component"); */

  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
    () => gameStateController.getSnapshot(), // getServerSnapshot for SSR
  );
  const hasOwnedLocations = gameState?.ownedLocations
    ? !!Object.keys(gameState?.ownedLocations)?.length
    : false;

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
  const drawingServiceRef = useRef<DrawingService>(null);
  const zoomControllerRef = useRef<ZoomController>(new ZoomController());
  const [, forceUpdate] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showNeighborsPanel, setShowNeighborsPanel] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const layersRenderedRef = useRef(0);
  const totalLayersRef = useRef(0);

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
    ctx.fillRect(0, 0, worldMapConfig.width, worldMapConfig.height);
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
      path: worldMapConfig.colorMapFileName,
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
      path: worldMapConfig.borderMapFileName,
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
      path: worldMapConfig.terrainLayerFileName,
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

  // Watch for hoveredLocation changes and manage neighbors panel timer
  useEffect(() => {
    const hoveredLocation = context.hoveredLocation;

    // Clear existing timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    // Reset neighbors panel if no location
    if (!hoveredLocation) {
      setShowNeighborsPanel(false);
    } else {
      // Start new timer for this location
      hoverTimerRef.current = setTimeout(() => {
        setShowNeighborsPanel(true);
      }, 1500);
    }

    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [context.hoveredLocation]);

  useEffect(() => {
    console.log("enter useEffect for setup worldmap component");

    if (!gameData) {
      console.log("game data not yet loaded");
      return;
    }

    if (initializedRef.current) {
      console.log("worldmap component already initialized, skipping");
      return;
    }

    waitForInitialization(); // TODO: what does this do again ?

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

    if (workerManager.isAvailable()) {
      workerManager.queueTask({
        id: "initGraphWorkerTask",
        type: "initGraphWorker",
        payload: {
          type: "initGraphWorker",
        },
      });
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
          if (layer.initializeWorkerCanvas && workerManager.isAvailable()) {
            const config = workerManagerConfig.workers.find((w) =>
              w.workerFileName.includes("canvas"),
            );
            if (!config) {
              throw new Error("could not find canvas worker config");
            }

            const imageData = ctx.getImageData(
              0,
              0,
              worldMapConfig.width,
              worldMapConfig.height,
            );
            for (let i = 0; i < config.poolSize; i++) {
              const taskId = `initWithImage-${i}`;
              const pixelDataCopy = new Uint8ClampedArray(imageData.data);
              workerManager.queueTask({
                id: taskId,
                type: "initWithImage",
                payload: {
                  type: "initWithImage",
                  pixelDataBuffer: pixelDataCopy.buffer,
                  canvasWidth: worldMapConfig.width,
                  canvasHeight: worldMapConfig.height,
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
    proximityComputationController.init();
    neighborsProximityComputationController.init();

    drawingServiceRef.current = new DrawingService(
      areaDrawingCanvasRef.current!,
      constructibleCanvasRef.current!,
      { width: worldMapConfig.width, height: worldMapConfig.height },
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

        const location = gameData.locationDataMap[clickedOnLocationRef.current];

        if (location && location.ownable) {
          setSelectedLocation(clickedOnLocationRef.current);
          gameStateController.selectLocation(clickedOnLocationRef.current);
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

    console.log({ workerManagerConfig });

    workerManager.queueTask({
      id: "testDummyTask",
      type: "dummy",
      payload: { type: "dummy" },
    });

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
            height={worldMapConfig.height}
            width={worldMapConfig.width}
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
          {hasOwnedLocations && (
            <GuiElement className={"fixed left-5 top-5"}>
              <ConstructibleMenusComponent></ConstructibleMenusComponent>
            </GuiElement>
          )}
          <GuiElement className="fixed left-5 right-5 bottom-1">
            <InfoBoxComponent />
          </GuiElement>
          {showNeighborsPanel && hoveredLocation && (
            <GuiElement className="fixed left-5 bottom-20">
              <NeighborsPanelComponent locationName={hoveredLocation} />
            </GuiElement>
          )}

          <GuiElement className="fixed right-5 bottom-15">
            <div className="gap-2 flex flex-col">
              <WorkerStatusComponent />
              <div className="flex flex-row gap-2 ">
                <button
                  onClick={handleZoomOut}
                  className={`w-8 border border-white rounded-md px-2 py-1`}
                >
                  -
                </button>
                <button
                  onClick={handleZoomIn}
                  className={`w-8 border border-white rounded-md px-2 py-1`}
                >
                  +
                </button>
              </div>
            </div>
          </GuiElement>
        </div>
      )}
    </div>
  );
}
