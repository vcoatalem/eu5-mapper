"use client";

import { workerManager } from "./workerManager";
import { CameraController } from "./cameraController";
import { ActionEventDispatcher } from "./actionEventDispatcher";
import { GameStateModel } from "./gameState.model";
import { ColorSearchModel } from "./colorSearch.model";
import { LocationSearchModel } from "./locationSearch.model";
import { LayerVisibilityModel } from "./layerVisibility.model";
import { CountryModifiersModel } from "./countryModifiers.model";
import {
  EditModeModel,
  maritimeSliceFromState,
  roadSliceFromState,
} from "./editMode.model";
import {
  ProximityComputationModel,
  IProximityComputationResults,
} from "./proximityComputation.model";
import { ShortestPathModel, IShortestPathResult } from "./shortestPath.model";
import {
  NeighborsProximityModel,
  NeighborsProximityResults,
} from "./neighborsProximityComputation.model";
import { LayerInvalidationModel } from "./layerInvalidation.model";
import { Observable } from "./observable";
import { ObservableCombiner } from "./observableCombiner";
import { LocationColorIndex } from "./locationColorIndex";
import { TileRenderer } from "./tiling/tileRenderer";
import { TileVirtualizationManager } from "./tiling/tileVirtualizationManager";
import { LocationHierarchyService } from "./locationHierarchy.service";
import { LocationsHelper } from "./locations.helper";
import { worldMapConfig } from "../components/worldMap.config";
import { SelectionModel } from "./selection.model";
import type { TileUrlGrid } from "./tiling/tileTypes";
import type { GameData, LocationIdentifier } from "./types/general";
import type { GameDataVersion } from "../config/gameData.config";
import type { RefObject } from "react";

export interface GameEngineDomRefs {
  container: RefObject<HTMLDivElement | null>;
  world: RefObject<HTMLDivElement | null>;
  hitSurface: RefObject<HTMLDivElement | null>;
}

export interface ImagePaths {
  locationsImage: string;
}

export class GameEngine {
  // Layer 0
  readonly cameraController: CameraController;
  readonly actionEventsController: ActionEventDispatcher;

  // Layer 1
  readonly gameStateController: GameStateModel;
  readonly colorSearchController: ColorSearchModel;
  readonly locationSearchController: LocationSearchModel;
  readonly layerVisibilityController: LayerVisibilityModel;
  readonly countryModifiersController: CountryModifiersModel;

  // Layer 2
  readonly editModeController: EditModeModel;
  readonly proximityController: ProximityComputationModel;
  readonly shortestPathController: ShortestPathModel;
  readonly neighborsProximityController: NeighborsProximityModel;

  // Layer 3 — debounced variants exposed for UI subscription
  readonly debouncedProximity: Observable<IProximityComputationResults>;
  readonly debouncedNeighborsProximity: Observable<NeighborsProximityResults>;
  readonly debouncedShortestPath: Observable<IShortestPathResult>;

  // Layer 4
  readonly layerInvalidationController: LayerInvalidationModel;

  // UI-driving model
  readonly selectionController: SelectionModel;

  private tileManager: TileVirtualizationManager | null = null;
  private subs: Array<() => void> = [];

  constructor(
    private gameData: GameData,
    private version: GameDataVersion,
  ) {
    this.cameraController = new CameraController();
    this.actionEventsController = new ActionEventDispatcher();

    this.gameStateController = new GameStateModel();
    this.colorSearchController = new ColorSearchModel();
    this.locationSearchController = new LocationSearchModel();
    this.layerVisibilityController = new LayerVisibilityModel();
    this.countryModifiersController = new CountryModifiersModel();

    const debouncedGameState = this.gameStateController.debounce(50);
    this.editModeController = new EditModeModel(this.gameStateController);
    this.proximityController = new ProximityComputationModel(
      debouncedGameState,
    );
    this.shortestPathController = new ShortestPathModel(
      this.gameStateController,
    );
    this.neighborsProximityController = new NeighborsProximityModel(
      this.gameStateController,
    );

    this.debouncedProximity = this.proximityController.debounce(100);
    this.debouncedNeighborsProximity =
      this.neighborsProximityController.debounce(100);
    this.debouncedShortestPath = this.shortestPathController.debounce(10);

    this.layerInvalidationController = new LayerInvalidationModel(
      this.colorSearchController,
      this.gameStateController,
      this.editModeController,
      this.cameraController,
      this.proximityController,
      this.actionEventsController,
    );

    this.selectionController = new SelectionModel();
  }

  async init(
    domRefs: GameEngineDomRefs,
    imagePaths: ImagePaths,
    tileUrls: TileUrlGrid,
  ): Promise<void> {
    // 1. Async asset loading
    const locationColorIndex = new LocationColorIndex();
    await locationColorIndex.init(imagePaths.locationsImage);

    // 2. Rendering pipeline
    this.layerInvalidationController.init(this.gameData);
    const tileRenderer = new TileRenderer(
      this.layerInvalidationController,
      locationColorIndex,
      tileUrls,
    );
    this.tileManager = new TileVirtualizationManager(
      domRefs.world.current!,
      tileRenderer,
      this.layerInvalidationController,
      this.cameraController,
      this.layerVisibilityController,
    );

    // 3. Camera DOM setup
    this.cameraController.initCamera(
      domRefs.container,
      domRefs.world,
      domRefs.hitSurface,
      locationColorIndex,
    );
    this.cameraController.init(domRefs.hitSurface.current!);
    this.setInitialCameraPosition(domRefs);

    // 4. Drag handling
    const hitSurface = domRefs.hitSurface.current!;
    let startX = 0,
      startY = 0,
      scrollLeft = 0,
      scrollTop = 0;

    const handleMouseDown = (e: MouseEvent) => {
      this.cameraController.setDragging(true);
      hitSurface.style.cursor = "grabbing";
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = parseFloat(domRefs.world.current?.style.left ?? "0") || 0;
      scrollTop = parseFloat(domRefs.world.current?.style.top ?? "0") || 0;
      this.tileManager?.startLoop();
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (
        !this.cameraController.getSnapshot().isDragging ||
        !domRefs.world.current
      )
        return;
      e.preventDefault();
      domRefs.world.current.style.left =
        scrollLeft + (e.clientX - startX) + "px";
      domRefs.world.current.style.top = scrollTop + (e.clientY - startY) + "px";
    };
    const stopDrag = () => {
      this.cameraController.setDragging(false);
      hitSurface.style.cursor = "default";
      this.tileManager?.stopLoop();
    };

    hitSurface.addEventListener("mousedown", handleMouseDown);
    hitSurface.addEventListener("mousemove", handleMouseMove);
    hitSurface.addEventListener("mouseup", stopDrag);
    hitSurface.addEventListener("mouseleave", stopDrag);

    this.subs.push(() => {
      hitSurface.removeEventListener("mousedown", handleMouseDown);
      hitSurface.removeEventListener("mousemove", handleMouseMove);
      hitSurface.removeEventListener("mouseup", stopDrag);
      hitSurface.removeEventListener("mouseleave", stopDrag);
    });

    // 5. Action event sources
    const getLocationsAtPointer = this.getLocationsAtPointer;
    this.actionEventsController.init();
    this.actionEventsController.registerHoverActionSource(
      hitSurface,
      getLocationsAtPointer,
      null,
      800,
    );
    this.actionEventsController.registerClickActionSource(
      hitSurface,
      getLocationsAtPointer,
      "acquire",
    );

    // 6. Cross-model mediation
    this.wireInteractionSubscriptions();

    // 7. Non-blocking inits
    this.gameStateController.init(this.gameData, this.version);
    this.proximityController.init();
    this.neighborsProximityController.init();
    this.locationSearchController.init(this.gameData);
    this.colorSearchController.init(worldMapConfig, this.gameData);
    this.editModeController.init();
    this.shortestPathController.init();
    this.layerVisibilityController.init(this.cameraController);

    // Init worker graph
    if (workerManager.isAvailable()) {
      workerManager.clearAssignments();
      workerManager.queueTask({
        id: `initGraphWorkerTask-${Date.now()}`,
        type: "initGraphWorker",
        payload: {},
      });
    }

    // Fire-and-forget country modifiers load
    this.countryModifiersController.init(this.version);

    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  private setInitialCameraPosition(domRefs: GameEngineDomRefs): void {
    if (!domRefs.world.current || !domRefs.container.current) return;
    const containerRect = domRefs.container.current.getBoundingClientRect();
    const zoom = this.cameraController.getSnapshot().zoomLevel;
    const targetX = 7934,
      targetY = 1991;
    domRefs.world.current.style.left =
      containerRect.width / 2 - targetX * zoom + "px";
    domRefs.world.current.style.top =
      containerRect.height / 2 - targetY * zoom + "px";
    domRefs.world.current.style.transform = `scale(${zoom})`;
    domRefs.world.current.style.transformOrigin = "0 0";
  }

  private getLocationsAtPointer = (
    e: MouseEvent,
  ): LocationIdentifier[] | Promise<LocationIdentifier[]> => {
    const locationName = this.cameraController.getLocationAtPointer(
      e,
      this.gameData,
    );
    if (!locationName) return [];
    const state = this.editModeController.getSnapshot();
    if (
      state.modeEnabled === "acquire" &&
      state.acquireLocations?.brushSize !== "location"
    ) {
      const brushSize = state.acquireLocations.brushSize;
      const hierarchyValue =
        this.gameData.locationDataMap[locationName]?.hierarchy?.[brushSize];
      if (hierarchyValue) {
        return LocationHierarchyService.getAllLocationsInHierarchy(
          brushSize,
          hierarchyValue,
        );
      }
    }
    return [locationName];
  };

  private wireInteractionSubscriptions(): void {
    // Hover (maritime mode) → SelectionModel
    const hoverMaritime = new ObservableCombiner([
      this.actionEventsController.hoveredLocation,
      this.editModeController,
    ]);
    this.subs.push(hoverMaritime.dispose.bind(hoverMaritime));
    this.subs.push(
      hoverMaritime.subscribe(({ values: [{ locations }, editModeState] }) => {
        const maritimePresenceEditState = maritimeSliceFromState(editModeState);
        if (roadSliceFromState(editModeState).isModeEnabled) return;
        if (maritimePresenceEditState.selectedLocation) return;
        if (!maritimePresenceEditState.isModeEnabled) {
          this.selectionController.clear();
          return;
        }
        const location = locations[0];
        if (!location) {
          this.selectionController.clear();
          return;
        }
        const locationData =
          this.gameData.locationDataMap[location ?? ""] ?? null;
        if (!locationData) return;
        if (!LocationsHelper.isLocationEligibleForMaritime(locationData)) {
          this.selectionController.clear();
          return;
        }
        this.selectionController.update(location, null);
      }),
    );

    // Prolonged hover → SelectionModel + pan-on-search
    const prolongedHover = new ObservableCombiner([
      this.actionEventsController.prolongedHoverLocation,
      this.editModeController,
    ]);
    this.subs.push(prolongedHover.dispose.bind(prolongedHover));
    this.subs.push(
      prolongedHover.subscribe(
        ({ values: [{ locations, type, mouseCoordinate }, editModeState] }) => {
          if (type === "search") {
            if (locations.length > 0) {
              const coordinates =
                this.gameData.locationDataMap[locations[0]]?.centerCoordinates;
              if (coordinates)
                this.cameraController.panToCoordinate(coordinates);
            }
            return;
          }
          if (editModeState.modeEnabled === "road") return;
          if (editModeState.modeEnabled === "maritime") return;
          if (locations.length === 1) {
            const locationName = locations[0];
            if (
              !this.gameData.locationDataMap[locationName]?.ownable &&
              !this.gameData.locationDataMap[locationName]?.isSea &&
              !this.gameData.locationDataMap[locationName]?.isLake
            )
              return;
            this.selectionController.update(locationName, mouseCoordinate);
          } else {
            this.selectionController.clear();
          }
        },
      ),
    );

    // Click → model mutations + SelectionModel
    const click = new ObservableCombiner([
      this.actionEventsController.clickedLocationSource,
      this.editModeController,
    ]);
    this.subs.push(click.dispose.bind(click));
    this.subs.push(
      click.subscribe(
        ({
          values: [{ locations, type, mouseCoordinate }, mapEditModeState],
          changedIndex,
        }) => {
          if (changedIndex !== 0) return;
          const primaryLocation = locations?.[0] ?? null;
          const locationData =
            this.gameData.locationDataMap[primaryLocation ?? ""] ?? null;
          switch (true) {
            case locationData && mapEditModeState.modeEnabled === "capital":
              if (!LocationsHelper.isLocationEligibleForCapital(locationData))
                return;
              return this.editModeController.askForConfirmation(
                "capital",
                locationData.name,
              );
            case locations.length > 0 &&
              type === "acquire" &&
              mapEditModeState.modeEnabled === "acquire":
              return this.gameStateController.toggleLocationsOwnership(
                locations,
              );
            case locationData && mapEditModeState.modeEnabled === "road":
              if (!LocationsHelper.isLocationEligibleForRoad(locationData))
                return;
              this.selectionController.clear();
              this.editModeController.selectLocation("road", locationData.name);
              this.cameraController
                .panToCoordinate(locationData.centerCoordinates, 300, {
                  x: -25,
                  y: 25,
                })
                .then(() => {
                  this.selectionController.update(
                    primaryLocation,
                    mouseCoordinate,
                  );
                });
              break;
            case locationData && mapEditModeState.modeEnabled === "maritime":
              if (!LocationsHelper.isLocationEligibleForMaritime(locationData))
                return;
              if (
                mapEditModeState.maritime.selectedLocation === locationData.name
              ) {
                this.selectionController.clear();
                return this.editModeController.clearLocation("maritime");
              }
              this.selectionController.update(primaryLocation, mouseCoordinate);
              return this.editModeController.selectLocation(
                "maritime",
                locationData.name,
              );
            case !!(primaryLocation && type === "goto"):
              const coordinates =
                this.gameData.locationDataMap[primaryLocation]
                  ?.centerCoordinates;
              if (coordinates)
                this.cameraController.panToCoordinate(coordinates, 600);
              break;
          }
        },
      ),
    );
  }

  dispose(): void {
    this.tileManager?.dispose();
    this.layerInvalidationController.dispose();
    this.cameraController.cleanup();
    this.subs.forEach((u) => u());
    this.subs = [];
  }
}
