"use client";

import React, {
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
import { actionEventDispatcher } from "../lib/actionEventDispatcher";
import { IWorkerTaskInitWithImagePayload } from "@/workers/types/workerTypes";

export function WorldMapComponent() {
  const context = useContext(AppContext);
  const { gameData, isLoading: gameDataIsLoading, error: gameDataLoadingError } = context;

  console.log("render worldmap component", { gameDataIsLoading, gameDataLoadingError });

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
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const blackCanvasRef = useRef<HTMLCanvasElement>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement>(null);
  const areaDrawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const topLayerRef = useRef<HTMLCanvasElement>(null);
  const constructibleCanvasRef = useRef<HTMLCanvasElement>(null);
  const roadCanvasRef = useRef<HTMLCanvasElement>(null);
  const indicatorCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingServiceRef = useRef<DrawingService>(null);
  const cameraServiceRef = useRef<CameraService>(null);
  const [, forceUpdate] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showNeighborsPanel, setShowNeighborsPanel] =
    useState<ILocationIdentifier | null>(null);
  const layersRenderedRef = useRef(0);
  const totalLayersRef = useRef(0);

  const waitForInitialization = React.useCallback(async () => {
    try {
      // Wait for all layers to be rendered before removing loading screen
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

        // TODO: check that color canvas worker is initialized

        return () => {
          clearInterval(interval);
          clearTimeout(timeout);
        };
      });

      console.log(
        "[WorldMapComponent] All layers rendered, proceeding with initialization",
      );
      setLoadingError(null);
      setIsLoading(false);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Initialization failed";
      setLoadingError(errorMsg);
      setIsLoading(false);
      console.error("[WorldMapComponent] Initialization error:", errorMsg);
    }
  }, []);

  const createBlackCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, 0, worldMapConfig.width, worldMapConfig.height);
  };

  const createTransparentCanvas = () => {
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
      zIndex: 5,
      path: worldMapConfig.borderMapFileName,
    },
    {
      name: "areaDrawingLayer",
      ref: areaDrawingCanvasRef,
      zIndex: 2,
      createMethod: createTransparentCanvas,
    },
    {
      name: "terrainLayer",
      ref: terrainCanvasRef,
      zIndex: 4,
      path: worldMapConfig.terrainLayerFileName,
    },
    {
      name: "constructibleLayer",
      ref: constructibleCanvasRef,
      zIndex: 8,
      createMethod: createTransparentCanvas,
    },
    {
      name: "roadLayer",
      ref: roadCanvasRef,
      zIndex: 7,
      createMethod: createTransparentCanvas,
    },
    {
      name: "indicatorLayer",
      ref: indicatorCanvasRef,
      zIndex: 10,
      createMethod: createTransparentCanvas,
    },
  ];

  const triggerRender = useCallback(() => {
    forceUpdate({});
  }, []);

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

    // Clear any stale worker assignments from previous initialization attempts
    // This is critical when gameData changes and component re-initializes
    workerManager.clearAssignments();

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

    if (workerManager.isAvailable()) {
      // Use unique task ID with timestamp to avoid conflicts when re-initializing
      const uniqueTaskId = `initGraphWorkerTask-${Date.now()}`;
      workerManager.queueTask({
        id: uniqueTaskId,
        type: "initGraphWorker",
        payload: {}
      });
    }

    // effect variables: these will only be used inside this effect until destruction
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

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
              // TODO: make sure this has completed before removing loading screen
              // Use unique task ID with timestamp to avoid conflicts when re-initializing
              const uniqueTaskId = `initWithImage-${i}-${Date.now()}`;
              const pixelDataCopy = new Uint8ClampedArray(imageData.data);
              const taskPayload: IWorkerTaskInitWithImagePayload = {
                pixelDataBuffer: pixelDataCopy.buffer,
                canvasWidth: worldMapConfig.width,
                canvasHeight: worldMapConfig.height,
              };
              workerManager.queueTask({
                id: uniqueTaskId,
                type: "initWithImage",
                payload: taskPayload
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

    drawingServiceRef.current = new DrawingService(
      areaDrawingCanvasRef.current!,
      constructibleCanvasRef.current!,
      roadCanvasRef.current!,
      indicatorCanvasRef.current!,
      { width: worldMapConfig.width, height: worldMapConfig.height },
      gameData,
    );

    cameraServiceRef.current = new CameraService(
      containerRef!,
      colorCanvasRef!,
      layers,
    );

    gameStateController.init(gameData);
    proximityComputationController.init();
    neighborsProximityComputationController.init();
    locationSearchController.init(gameData);

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      triggerRender();
      startX = e.clientX;
      startY = e.clientY;
      const rect = colorCanvas.getBoundingClientRect();
      scrollLeft = rect.left;
      scrollTop = rect.top;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();

      const x = e.clientX - startX;
      const y = e.clientY - startY;

      layers.forEach((layer) => {
        const canvas = layer.ref.current;
        if (canvas) {
          canvas.style.left = scrollLeft + x + "px";
          canvas.style.top = scrollTop + y + "px";
        }
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      triggerRender();
    };

    zoomController.init(topLayerRef.current);

    zoomController.subscribe(({ zoomLevel, oldZoomLevel }) => {
      if (!borderCanvasRef.current) {
        console.error(
          "[WorldMapComponent] borderCanvasRef is nullish. Check if this is due to HMR or proper bug",
        );
        return;
      }
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

    actionEventDispatcher.registerHoverActionSource(
      topLayerRef.current,
      (e) => {
        const locationName = cameraServiceRef.current?.getLocationAtPointer(e);
        return locationName ?? null;
      },
      null,
      800,
    );

    actionEventDispatcher.registerClickActionSource(
      topLayerRef.current,
      (e) => {
        const locationName = cameraServiceRef.current?.getLocationAtPointer(e);
        return locationName ?? null;
      },
      "acquire",
    );

    actionEventDispatcher.prolongedHoverLocation.subscribe(
      ({ location }) => {
        setShowNeighborsPanel(location);
      },
    );

    actionEventDispatcher.clickedLocationSource.subscribe(
      ({ location, type }) => {
        if (location && type === "acquire") {
          gameStateController.selectLocation(location);
        }
        if (location && type === "goto") {
          const coordinates = DrawingHelper.gameCoordinatesToCanvasCoordinates(
            gameData.locationDataMap[location]
              ?.constructibleLocationCoordinate ?? { x: 0, y: 0 },
            colorCanvasRef.current?.height ?? 0,
          );
          cameraServiceRef.current?.panToCoordinate(coordinates);
        }
      },
    );

    actionEventDispatcher.prolongedHoverLocation.subscribe(
      ({ location, type }) => {
        if (location && type === "search") {
          const coordinates = DrawingHelper.gameCoordinatesToCanvasCoordinates(
            gameData.locationDataMap[location]
              ?.constructibleLocationCoordinate ?? { x: 0, y: 0 },
            colorCanvasRef.current?.height ?? 0,
          );
          cameraServiceRef.current?.panToCoordinate(coordinates);
        }
      },
    );

    if (topLayerRef.current) {
      console.log("add drag mouse event listeners");
      topLayerRef.current.addEventListener("mousedown", handleMouseDown);
      topLayerRef.current.addEventListener("mousemove", handleMouseMove);
      topLayerRef.current.addEventListener("mouseup", handleMouseUp);
    }

    setInitialPosition();
    initializedRef.current = true;

    console.log({ workerManagerConfig });

    // Use unique task ID to avoid conflicts when re-initializing
    const uniqueDummyTaskId = `testDummyTask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    workerManager.queueTask({
      id: uniqueDummyTaskId,
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
        actionEventDispatcher.clearEventListenersForElement(
          topLayerRef.current,
        );
      }
      initializedRef.current = false;
    };
  }, [gameData]);

  const handleZoomOut = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    zoomController.zoomOut();
  };

  const handleZoomIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
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
      {(() => {
        switch (true) {
          case gameDataIsLoading:
            return <LoadingScreenComponent message="Loading game data..." />;
          case !!gameDataLoadingError:
            return <LoadingScreenComponent message={gameDataLoadingError} />;
          case !!isLoading: // rendering canvases
            return <LoadingScreenComponent message="Rendering map..." />;
          default:
            return <></>;
        }
      })()}
      {layers.map((layer) => (
        <canvas
          ref={layer.ref}
          height={worldMapConfig.height}
          width={worldMapConfig.width}
          key={layer.zIndex}
          className="absolute"
          style={{
            zIndex: layer.zIndex,
            imageRendering: "pixelated",
          }}
        />
      ))}

      <div className={`${isLoading ? "hidden" : "visible"}`}>
        <GuiElement className="fixed top-2 left-5 right-5 z-50">
          {/* z-50 here is so that dropdowns from header show above of other guiElement */}
          <HeaderComponent />
        </GuiElement>
        {hasOwnedLocations && (
          <GuiElement className="fixed left-5 top-18">
            <ConstructibleMenusComponent />
          </GuiElement>
        )}
        <GuiElement className="fixed left-5 right-5 bottom-1">
          <InfoBoxComponent />
        </GuiElement>
        {showNeighborsPanel && (
          <GuiElement className="fixed left-5 bottom-20">
            <NeighborsPanelComponent locationName={showNeighborsPanel} />
          </GuiElement>
        )}

        <GuiElement className="fixed right-5 top-16">
          <CountryOverview />
        </GuiElement>

        <GuiElement className="fixed right-20 bottom-15">
          <button onClick={handleZoomOut} className="w-8 px-2 py-1">
            -
          </button>
        </GuiElement>
        <GuiElement className="fixed right-5 bottom-15">
          <button onClick={handleZoomIn} className="w-8 px-2 py-1">
            +
          </button>
        </GuiElement>
      </div>
    </div>
  );
}

export default WorldMapComponent;
