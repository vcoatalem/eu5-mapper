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
import { zoomController, zoomLevels } from "@/app/lib/zoomController";
import { proximityComputationController } from "@/app/lib/proximityComputation.controller";
import { ConstructibleMenusComponent } from "./constructibleMenus.component";
import { GuiElement } from "./guiElement";
import { workerManagerConfig } from "../lib/workerManager.config";
import { worldMapConfig } from "./worldMap.config";
import { neighborsProximityComputationController } from "../lib/neighborsProximityComputation.controller";
import { NeighborsPanelComponent } from "./neighborsPanel.component";
import { HeaderComponent } from "./header.component";
import { CountryOverview } from "./countryOverview.component";
import { locationSearchController } from "@/app/lib/locationSearchController";
import { DrawingHelper } from "../lib/drawing/drawing.helper";
import { CameraService } from "../lib/camera.service";

export function WorldMapComponent() {
  const context = useContext(AppContext);
  const {
    hoveredLocation,
    setSelectedLocation,
    selectedLocation,
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
  const constructibleCanvasRef = useRef<HTMLCanvasElement>(null);
  const roadCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingServiceRef = useRef<DrawingService>(null);
  const cameraServiceRef = useRef<CameraService>(null);
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
    {
      name: "roadLayer",
      ref: roadCanvasRef,
      zIndex: 10,
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

  // initialization effect
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

    const setInitialPosition = () => {
      // Position user at coordinates X: 7934, Y: 1991
      if (!colorCanvas || !container) return;

      // Use smooth pan for initial position
      cameraServiceRef.current?.panToCoordinate({ x: 7934, y: 1991 }, 0);
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
    locationSearchController.init(gameData);

    drawingServiceRef.current = new DrawingService(
      areaDrawingCanvasRef.current!,
      constructibleCanvasRef.current!,
      roadCanvasRef.current!,
      { width: worldMapConfig.width, height: worldMapConfig.height },
      gameData,
    );

    cameraServiceRef.current = new CameraService(
      containerRef!,
      colorCanvasRef!,
      layers,
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
      const location = cameraServiceRef.current?.getLocationAtPointer(e);
      if (location) {
        clickedOnLocationRef.current = location;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const hoverLocation = cameraServiceRef.current?.getLocationAtPointer(e);
      setHoveredLocation(hoverLocation ?? null);

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
        zoomController.zoomOut();
      } else {
        zoomController.zoomIn();
      }
    };

    zoomController.subscribe(({ zoomLevel, oldZoomLevel }) => {
      cameraServiceRef.current?.applyZoomLevel(zoomLevel, oldZoomLevel);

      if (zoomLevel < zoomLevels.normal && oldZoomLevel >= zoomLevels.normal) {
        borderCanvasRef.current!.style.visibility = "hidden";
      } else if (
        zoomLevel >= zoomLevels.normal &&
        oldZoomLevel < zoomLevels.normal
      ) {
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

  // pan to location effect
  useEffect(() => {
    if (!gameData || !selectedLocation) {
      return;
    }
    const coordinates = DrawingHelper.gameCoordinatesToCanvasCoordinates(
      gameData.locationDataMap[selectedLocation]
        ?.constructibleLocationCoordinate ?? { x: 0, y: 0 },
      colorCanvasRef.current?.height ?? 0,
    );
    cameraServiceRef.current?.panToCoordinate(coordinates);
  }, [selectedLocation]);

  const handleZoomOut = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelectedLocation(null);
    zoomController.zoomOut();
  };

  const handleZoomIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelectedLocation(null);
    zoomController.zoomIn();
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
          <GuiElement className="fixed top-2 left-5 right-5 z-50">
            {/* z-50 here is so that dropdowns from header show above of other guiElement */}
            <HeaderComponent />
          </GuiElement>
          {hasOwnedLocations && (
            <GuiElement className={"fixed left-5 top-18"}>
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

          <GuiElement className="fixed right-5 top-16">
            <CountryOverview />
          </GuiElement>

          <GuiElement className="fixed right-20 bottom-15">
            <button onClick={handleZoomOut} className={`w-8 px-2 py-1`}>
              -
            </button>
          </GuiElement>
          <GuiElement className="fixed right-5 bottom-15">
            <button onClick={handleZoomIn} className={`w-8  px-2 py-1`}>
              +
            </button>
          </GuiElement>
        </div>
      )}
    </div>
  );
}
