"use client";

import React, {
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import {
  cameraController,
  zoomLevels,
  NeighborsPanelPlacement,
} from "@/app/lib/cameraController";
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
import { actionEventDispatcher } from "../lib/actionEventDispatcher";
import { IWorkerTaskInitWithImagePayload } from "@/workers/types/workerTypes";
import { ObservableCombiner } from "../lib/observableCombiner";
import { roadBuilderController } from "@/app/lib/roadBuilderController";

export function WorldMapComponent() {
  const context = useContext(AppContext);
  const {
    gameData,
    imagePaths,
    isLoading: gameDataIsLoading,
    error: gameDataLoadingError,
  } = context;

  /*  console.log("render worldmap component", { gameDataIsLoading, gameDataLoadingError }); */

  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
    () => gameStateController.getSnapshot(), // getServerSnapshot for SSR
  );
  const hasOwnedLocations = gameState?.ownedLocations
    ? !!Object.keys(gameState?.ownedLocations)?.length
    : false;
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
  const [, forceUpdate] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const [showNeighborsPanel, setShowNeighborsPanel] =
    useState<ILocationIdentifier | null>(null);
  const [neighborsPanelPosition, setNeighborsPanelPosition] =
    useState<NeighborsPanelPlacement>(null);
  // Using ref instead of state: we use forceUpdate() (triggerRender) to trigger render
  // after applying the drag state, so we don't need useState's automatic re-renders.
  // The cursor style can read from ref.current during render, and the zoom controller
  // closure needs a ref to access the current value.
  const isDraggingRef = useRef(false);
  const layersRenderedRef = useRef(0);
  const imageLoadHandlersRef = useRef<
    Array<{ img: HTMLImageElement; layer: string }>
  >([]);
  const subscriptionsRef = useRef<Array<() => void>>([]);

  const waitForInitialization = React.useCallback(
    async (expectedLayerCount: number) => {
      try {
        // Wait for all layers to be rendered before removing loading screen
        await new Promise<void>((resolve, reject) => {
          const checkLayersRendered = () => {
            if (
              layersRenderedRef.current === expectedLayerCount &&
              expectedLayerCount > 0
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
            reject(
              new Error(
                "Layer initialization timed out after 30 seconds. Some layers may not have loaded correctly.",
              ),
            );
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
        setIsLoading(false);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Initialization failed";
        setIsLoading(false);
        console.error("[WorldMapComponent] Initialization error:", errorMsg);
      }
    },
    [],
  );

  const createBlackCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, 0, worldMapConfig.width, worldMapConfig.height);
  };

  const createTransparentCanvas = () => {
    // by default, canvas is transparent
    return;
  };

  // Memoize layers array to prevent recreation on every render
  const layers = useMemo<
    Array<{
      name: string;
      ref: RefObject<HTMLCanvasElement | null>;
      zIndex: number;
      path?: string;
      createMethod?: (ctx: CanvasRenderingContext2D) => unknown;
      initializeWorkerCanvas?: boolean;
    }>
  >(
    () => [
      {
        name: "colorLayer",
        ref: colorCanvasRef,
        zIndex: 0,
        path: imagePaths?.locationsImage,
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
        path: imagePaths?.borderLayer,
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
        path: imagePaths?.terrainLayer,
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
    ],
    [
      imagePaths?.locationsImage,
      imagePaths?.borderLayer,
      imagePaths?.terrainLayer,
    ],
  );

  const triggerRender = useCallback(() => {
    forceUpdate({});
  }, []);

  // initialization effect
  useEffect(() => {
    console.log("enter useEffect for setup worldmap component");

    // Reset subscription collection for this initialization run
    subscriptionsRef.current = [];

    if (!gameData) {
      console.log("game data not yet loaded");
      return;
    }

    if (!imagePaths) {
      console.log("image paths not yet loaded");
      return;
    }

    if (initializedRef.current) {
      console.log("worldmap component already initialized, skipping");
      return;
    }

    setInitializationError(null);

    // Clear any stale worker assignments from previous initialization attempts
    // This is critical when gameData changes and component re-initializes
    workerManager.clearAssignments();

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
        payload: {},
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

      // Ensure canvas has initial position set before panning
      // This prevents zoom calculations from using invalid positions
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      const initialZoom = cameraController.getSnapshot().zoomLevel;
      const targetX = 7934;
      const targetY = 1991;

      // Set initial position directly to avoid animation issues on first load
      const initialLeft = centerX - targetX * initialZoom;
      const initialTop = centerY - targetY * initialZoom;

      layers.forEach((layer) => {
        const canvas = layer.ref.current;
        if (canvas) {
          canvas.style.left = initialLeft + "px";
          canvas.style.top = initialTop + "px";
          canvas.style.transform = `scale(${initialZoom})`;
          canvas.style.transformOrigin = "0 0";
        }
      });
    };

    // Reset layer counter
    layersRenderedRef.current = 0;
    imageLoadHandlersRef.current = []; // Clear any previous handlers

    layers.forEach((layer) => {
      const ctx = layer.ref.current?.getContext("2d");
      if (!ctx) {
        console.log("could not get layer ref context");
        return;
      }
      if (layer.path) {
        const img = new Image();
        // Track the image for cleanup
        imageLoadHandlersRef.current.push({ img, layer: layer.name });

        img.onload = () => {
          // Check if this image is still being tracked (not cleaned up from a previous init)
          const isStillTracked = imageLoadHandlersRef.current.some(
            (handler) => handler.img === img && handler.layer === layer.name,
          );
          if (!isStillTracked) {
            // This image was cleaned up, ignore stale callback
            console.log(
              `[WorldMapInit] Ignoring stale onload callback for ${layer.name} (image was cleaned up)`,
            );
            return;
          }
          console.log(`[WorldMapInit] loaded image for layer ${layer.name}`);
          ctx.drawImage(img, 0, 0);
          layersRenderedRef.current++;
          console.log(
            `[WorldMapInit] initialized layer ${layer.name}. Total progress: ${layersRenderedRef.current}/${layers.length}`,
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
                payload: taskPayload,
              });
            }
          }
        };
        img.onerror = (e) => {
          console.error(
            `[WorldMapInit] Failed to load image for layer ${layer.name} from path: ${layer.path}`,
            e,
          );
          // Still increment counter even on error to prevent blocking
          layersRenderedRef.current++;
        };
        console.log(
          `[WorldMapInit] Starting to load image for layer ${layer.name} from: ${layer.path}`,
        );
        img.src = layer.path;
      } else if (layer.createMethod) {
        layer.createMethod(ctx);
        layersRenderedRef.current++;
        console.log(
          `[WorldMapInit] initialized layer ${layer.name}. Total progress: ${layersRenderedRef.current}/${layers.length}`,
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
    cameraController.initCamera(containerRef, colorCanvasRef, layers);
    roadBuilderController.init();

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      triggerRender();
      startX = e.clientX;
      startY = e.clientY;
      // Get positions relative to container, not viewport
      const canvasRect = colorCanvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // Store the current style.left/top values (container-relative)
      scrollLeft =
        parseFloat(colorCanvas.style.left) ||
        canvasRect.left - containerRect.left;
      scrollTop =
        parseFloat(colorCanvas.style.top) || canvasRect.top - containerRect.top;
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

    const handleMouseLeave = () => {
      // Stop dragging when mouse leaves the canvas
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        triggerRender();
      }
    };

    // Set initial position - will be set again after initialization completes
    // to ensure positions are correct before zoom controller is initialized
    setInitialPosition();

    console.log({ topLayerRefForCreate: topLayerRef });

    actionEventDispatcher.registerHoverActionSource(
      topLayerRef.current,
      (e) => {
        const locationName = cameraController.getLocationAtPointer(e);
        return locationName ?? null;
      },
      null,
      800,
    );

    actionEventDispatcher.registerClickActionSource(
      topLayerRef.current,
      (e) => {
        const locationName = cameraController.getLocationAtPointer(e);
        return locationName ?? null;
      },
      "acquire",
    );

    const prolongedHoverProximityCalculationObservable = new ObservableCombiner(
      [actionEventDispatcher.prolongedHoverLocation, roadBuilderController],
    );
    subscriptionsRef.current.push(
      prolongedHoverProximityCalculationObservable.dispose.bind(
        prolongedHoverProximityCalculationObservable,
      ),
    );

    const prolongedHoverOutsideBuildingMode =
      prolongedHoverProximityCalculationObservable.subscribe(
        ({ values: [{ locations, type }, roadBuilderState] }) => {
          if (roadBuilderState.isBuildingModeEnabled) return;
          if (type === "search") return;
          if (locations.length === 1) {
            // only show neighbors panel if there is exactly one location hovered
            const locationName = locations[0];
            neighborsProximityComputationController.launchGetNeighborProximityTask(
              locationName,
            );
            console.log(
              "[WorldMapComponent] prolonged hover on location:",
              locationName,
              " will open up neighbors panel and trigger proximity computation",
            );
            setShowNeighborsPanel(locationName);
            const placement = cameraController.getPopoverPanelScreenPosition(
              locationName,
              gameData.locationDataMap,
              12,
              12,
            ) ?? {
              x: 500,
              y: 500,
              side: "right",
            };
            console.log(
              "[WorldMapComponent] setting neighbors panel position:",
              placement,
            );
            setNeighborsPanelPosition(placement);
          } else {
            console.log(
              "[WorldMapComponent] prolonged hover emitted either null or multiple locations, hiding neighbors panel",
            );
            setShowNeighborsPanel(null);
            setNeighborsPanelPosition(null);
          }
        },
      );
    subscriptionsRef.current.push(prolongedHoverOutsideBuildingMode);

    const clickObserver = new ObservableCombiner([
      actionEventDispatcher.clickedLocationSource,
      roadBuilderController,
    ]);
    subscriptionsRef.current.push(clickObserver.dispose.bind(clickObserver));

    const clickedLocationUnsubscribe = clickObserver.subscribe(
      ({ values: [{ location, type }, roadBuilderState], changedIndex }) => {
        if (changedIndex !== 0) {
          // only react to changes in clicked location
          return;
        }
        console.log({
          clickObserverCombiner: { location, type, roadBuilderState },
        });
        switch (true) {
          case location &&
            type === "acquire" &&
            !roadBuilderState.isBuildingModeEnabled:
            return gameStateController.selectLocation(location);
          case location && roadBuilderState.isBuildingModeEnabled:
            setShowNeighborsPanel(null);
            roadBuilderController.selectLocationForBuildingRoad(location);
            cameraController.panToCoordinate(
              gameData.locationDataMap[location]?.centerCoordinates,
            );
            neighborsProximityComputationController.launchGetNeighborProximityTask(
              location,
            );
            return setTimeout(() => {
              const position = cameraController.getPopoverPanelScreenPosition(
                location,
                gameData.locationDataMap,
                36,
                36,
              );
              if (!position) {
                console.error(
                  "[WorldMapComponent] could not get screen position for neighbors panel",
                );
                return;
              }
              setShowNeighborsPanel(location);
              setNeighborsPanelPosition(position);
            }, 800); // allow time for panning to be done (todo: handle screen panning as a proper observable)
          case location && type === "goto":
            const coordinates =
              gameData.locationDataMap[location]?.centerCoordinates;
            if (coordinates) {
              cameraController.panToCoordinate(coordinates, 600);
            }
            break;
        }
      },
    );
    subscriptionsRef.current.push(clickedLocationUnsubscribe);

    const prolongedHoverSearchUnsubscribe =
      actionEventDispatcher.prolongedHoverLocation.subscribe(
        ({ locations, type }) => {
          if (locations.length > 0 && type === "search") {
            const location = locations[0];
            const coordinates =
              gameData.locationDataMap[location]?.centerCoordinates;
            cameraController.panToCoordinate(coordinates);
          }
        },
      );
    subscriptionsRef.current.push(prolongedHoverSearchUnsubscribe);

    if (topLayerRef.current) {
      // TODO: fix weird dragging behavior with right click + left click, drag + zoom, etc.
      console.log("add drag mouse event listeners");
      topLayerRef.current.addEventListener("mousedown", handleMouseDown);
      topLayerRef.current.addEventListener("mousemove", handleMouseMove);
      topLayerRef.current.addEventListener("mouseup", handleMouseUp);
      topLayerRef.current.addEventListener("mouseleave", handleMouseLeave);

      cameraController.setDraggingCheck(() => isDraggingRef.current);
      cameraController.init(topLayerRef.current);

      // Subscribe to zoom changes
      const zoomUnsubscribe = cameraController.subscribe(
        ({ zoomLevel, oldZoomLevel }) => {
          if (!borderCanvasRef.current) {
            console.error(
              "[WorldMapComponent] borderCanvasRef is nullish. Check if this is due to HMR or proper bug",
            );
            return;
          }
          cameraController.applyZoomLevel(zoomLevel, oldZoomLevel);

          if (
            zoomLevel < zoomLevels.normal &&
            oldZoomLevel >= zoomLevels.normal
          ) {
            borderCanvasRef.current!.style.visibility = "hidden";
          } else if (
            zoomLevel >= zoomLevels.normal &&
            oldZoomLevel < zoomLevels.normal
          ) {
            borderCanvasRef.current!.style.visibility = "visible";
          }
        },
      );
      subscriptionsRef.current.push(zoomUnsubscribe);
    }

    // init all controllers (after subscriptions to trigger first subscriptions)
    gameStateController.init(gameData);
    proximityComputationController.init();
    neighborsProximityComputationController.init();
    locationSearchController.init(gameData);
    roadBuilderController.init();

    // Mark as initialized only after waitForInitialization completes
    waitForInitialization(layers.length)
      .then(() => {
        initializedRef.current = true;
        setInitializationError(null);
      })
      .catch((error) => {
        const errorMsg =
          error instanceof Error ? error.message : "Initialization failed";
        console.error(
          "[WorldMapComponent] Initialization wait failed:",
          errorMsg,
        );
        setInitializationError(errorMsg);
        // Don't mark as initialized so the error screen stays visible
      });

    return () => {
      console.log(
        "enter cleanup for worldmap component -- async processed must be terminated, event listeners must be removed, and all subscriptions must be closed",
      );

      // Unsubscribe from all collected subscriptions
      subscriptionsRef.current.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.error(
            "[WorldMapComponent] Error during subscription cleanup:",
            error,
          );
        }
      });
      subscriptionsRef.current = [];

      // Cancel any pending image loads
      imageLoadHandlersRef.current.forEach(({ img }) => {
        img.onload = null;
        img.onerror = null;
        img.src = ""; // Cancel image load
      });
      imageLoadHandlersRef.current = [];

      // Reset layer counter and error state
      layersRenderedRef.current = 0;
      setInitializationError(null);

      // Clean up zoom controller
      cameraController.cleanup();

      if (topLayerRef.current) {
        console.log("remove mouse event listeners");
        topLayerRef.current.removeEventListener("mousedown", handleMouseDown);
        topLayerRef.current.removeEventListener("mousemove", handleMouseMove);
        topLayerRef.current.removeEventListener("mouseup", handleMouseUp);
        topLayerRef.current.removeEventListener("mouseleave", handleMouseLeave);
        actionEventDispatcher.clearEventListenersForElement(
          topLayerRef.current,
        );
      }
      initializedRef.current = false;
    };
  }, [gameData, imagePaths]);

  const handleZoomOut = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    cameraController.zoomOut();
  };

  const handleZoomIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    cameraController.zoomIn();
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
            return (
              <LoadingScreenComponent
                message="Loading game data..."
                progress={25}
              />
            );
          case !!gameDataLoadingError:
            return (
              <LoadingScreenComponent
                message={gameDataLoadingError}
                error={true}
              />
            );
          case !!initializationError:
            return (
              <LoadingScreenComponent
                message={initializationError}
                error={true}
              />
            );
          case !!isLoading: // rendering canvases
            return (
              <LoadingScreenComponent
                message="Rendering map..."
                progress={75}
              />
            );
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
        <div className="fixed left-5 top-16 flex flex-col gap-2 z-50 max-h-[85vh] min-h-0 overflow-y-auto">
          <GuiElement className="w-fit min-h-0 shrink overflow-hidden">
            <CountryOverview />
          </GuiElement>
          <GuiElement className="w-fit min-h-0 shrink overflow-hidden">
            {hasOwnedLocations ? (
              <ConstructibleMenusComponent />
            ) : (
              <div className="max-w-52 text-stone-400 text-italic">
                No locations selected - either select a country above, or create
                your own country from scratch by selecting a location
              </div>
            )}
          </GuiElement>
        </div>
        <GuiElement className="fixed left-5 right-5 bottom-1">
          <InfoBoxComponent />
        </GuiElement>
        {showNeighborsPanel && (
          <GuiElement
            className="fixed pointer-events-none"
            style={
              neighborsPanelPosition
                ? neighborsPanelPosition.side === "right"
                  ? {
                      left: neighborsPanelPosition.x,
                      top: neighborsPanelPosition.y,
                      transform: "translate(0, 0)",
                    }
                  : {
                      left: neighborsPanelPosition.x,
                      top: neighborsPanelPosition.y,
                      transform: "translate(-100%, 0)",
                    }
                : { left: 20, top: 80 }
            }
          >
            <div className="pointer-events-auto">
              <NeighborsPanelComponent locationName={showNeighborsPanel} />
            </div>
          </GuiElement>
        )}

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
