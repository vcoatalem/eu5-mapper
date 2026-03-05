import { gameStateController } from "@/app/lib/gameState.controller";
import {
  IProximityComputationResults,
  proximityComputationController,
} from "@/app/lib/proximityComputation.controller";
import { ICoordinate, IGameData, ILocationIdentifier } from "./types/general";
import { ObservableCombiner } from "./observableCombiner";
import { DrawingHelper } from "./drawing/drawing.helper";
import {
  IZoomState,
  cameraController,
  zoomLevels,
} from "@/app/lib/cameraController";
import {
  capitalColor,
  ColorHelper,
  defaultAreaColor,
} from "./drawing/color.helper";
import { Subject } from "./subject";
import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";
import {
  editModeController,
  maritimeSliceFromState,
  roadSliceFromState,
} from "@/app/lib/editMode.controller";
import { colorSearchController } from "@/app/lib/colorSeach.controller";
import { ObjectHelper } from "@/app/lib/object.helper";
import { RoadsHelper } from "@/app/lib/roads.helper";
import { ArrayHelper } from "@/app/lib/array.helper";
import { LocationRank } from "@/app/lib/types/locationRank";
import { IGameState } from "@/app/lib/types/gameState";

enum CanvasName {
  areas = "areas",
  constructibles = "constructibles",
  roads = "roads",
  indicators = "indicators",
  maritimePresences = "maritimePresences",
}

type CanvasRecord = Record<CanvasName, CanvasRenderingContext2D>;

export class DrawingService {
  private canvasRecord: CanvasRecord;
  private mapInfos: { width: number; height: number };
  private gameData: IGameData | null = null;
  private drawingCallbackBuffer: Partial<
    Record<CanvasName, () => ILocationIdentifier[] | null> // returned identifiers are those of locations for which coordinates need to be fetched
  > = {};
  private reDraw: Subject<Date> = new Subject<Date>();

  constructor(
    areaDrawingCanvas: HTMLCanvasElement,
    constructibleDrawingCanvas: HTMLCanvasElement,
    roadDrawingCanvas: HTMLCanvasElement,
    indicatorDrawingCanvas: HTMLCanvasElement,
    maritimePresenceDrawingCanvas: HTMLCanvasElement,
    mapInfos: { width: number; height: number },
    gameData: IGameData,
  ) {
    this.mapInfos = mapInfos;
    this.gameData = gameData;

    const canvasList = [
      { name: CanvasName.areas, canvas: areaDrawingCanvas },
      { name: CanvasName.constructibles, canvas: constructibleDrawingCanvas },
      { name: CanvasName.roads, canvas: roadDrawingCanvas },
      { name: CanvasName.indicators, canvas: indicatorDrawingCanvas },
      {
        name: CanvasName.maritimePresences,
        canvas: maritimePresenceDrawingCanvas,
      },
    ]
      .map(({ name, canvas }) => ({
        name,
        context: canvas.getContext("2d", {}),
      }))
      .map(({ name, context }) => {
        if (!context) {
          throw new Error(`Could not get drawing context for canvas ${name}`);
        }
        return { name, context };
      });

    this.canvasRecord = ArrayHelper.reduceToRecord(
      canvasList,
      (canvas) => canvas.name,
      (canvas) => canvas.context,
    );

    colorSearchController.subscribe(() => {
      /* console.log("[DrawingService] colorSearchController subscription triggered"); */
      this.reDraw.emit(new Date());
    });

    new ObservableCombiner([
      gameStateController,
      proximityComputationController,
    ])
      .debounce(10)
      .subscribe(({ values: [gameState, proximityEvaluation] }) => {
        /* console.log("[DrawingService] gameState x ProximityEvaluation subscription triggered", { gameState, proximityEvaluation }); */
        this.drawingCallbackBuffer["areas"] = () =>
          this.drawAreas(gameState, proximityEvaluation);
        this.drawingCallbackBuffer["roads"] = () => this.drawRoads(gameState);
        this.drawingCallbackBuffer["maritimePresences"] = () =>
          this.drawMaritimePresence(gameState.temporaryLocationData);
        this.reDraw.emit(new Date());
      });

    new ObservableCombiner([gameStateController, cameraController])
      .debounce(10)
      .subscribe(({ values: [gameState, zoom] }) => {
        this.drawingCallbackBuffer["constructibles"] = () =>
          this.drawConstructibles(gameState, zoom);
        this.reDraw.emit(new Date());
      });

    new ObservableCombiner([
      actionEventDispatcher.prolongedHoverLocation,
      actionEventDispatcher.hoveredLocation,
      editModeController,
    ]).subscribe(
      ({
        values: [prolongedHoverLocation, hoveredLocation, editModeState],
      }) => {
        const roadSlice = roadSliceFromState(editModeState);
        const maritimeSlice = maritimeSliceFromState(editModeState);
        const toHighlight = Array.from(
          new Set([
            ...(roadSlice.isModeEnabled && roadSlice.selectedLocation
              ? [roadSlice.selectedLocation]
              : []),
            ...(maritimeSlice.isModeEnabled && maritimeSlice.selectedLocation
              ? [maritimeSlice.selectedLocation]
              : []),
            ...(hoveredLocation?.locations ?? []),
            ...(prolongedHoverLocation?.locations ?? []),
          ]),
        );
        toHighlight.sort();
        this.drawingCallbackBuffer["indicators"] = () =>
          this.drawHighlighted(toHighlight);
        this.reDraw.emit(new Date());
      },
    );

    this.reDraw.debounce(5).subscribe(() => {
      for (const [canvasName, callback] of ObjectHelper.getTypedEntries(
        this.drawingCallbackBuffer,
      )) {
        const missingCoordinates = callback() as ILocationIdentifier[];
        if (!missingCoordinates?.length) {
          delete this.drawingCallbackBuffer[canvasName];
        } else {
          this.reDraw.emit(new Date());
        }
      }
    });

    this.reDraw.emit(new Date()); // this has to be after subscriptions are set up
  }

  private drawAreas(
    gameState: IGameState,
    proximityEvaluation: IProximityComputationResults,
  ): ILocationIdentifier[] {
    const imageData = this.canvasRecord["areas"].createImageData(
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const data = imageData.data;

    const missingCoordinates: ILocationIdentifier[] = [];
    const colorSearchResult = colorSearchController.getSnapshot().result;
    for (const location of Object.keys(gameState.ownedLocations)) {
      const entry = colorSearchResult[location];
      const coordinates = entry?.coordinates;
      if (!coordinates?.length) {
        missingCoordinates.push(location);
        continue;
      }
      const evaluation: number | undefined =
        proximityEvaluation.result?.[location]?.cost ?? -1;

      const color = ColorHelper.getEvaluationColor(evaluation);

      const [r, g, b] = color;

      for (const { x, y } of coordinates) {
        const index = (y * this.mapInfos.width + x) * 4;
        data[index] = r; // R
        data[index + 1] = g; // G
        data[index + 2] = b; // B
        data[index + 3] = 255; // A
      }
    }

    if (missingCoordinates.length > 0) {
      colorSearchController.requestColorSearch(missingCoordinates);
    }

    // Draw once
    this.canvasRecord["areas"].putImageData(imageData, 0, 0);
    return missingCoordinates;
  }

  private drawLocation(
    ctx: CanvasRenderingContext2D,
    level: LocationRank,
    zoom: IZoomState,
    coordinate: ICoordinate,
    isCapital: boolean,
  ): void {
    const color = isCapital ? capitalColor : defaultAreaColor;

    const skip = () => {
      return;
    };
    switch (level) {
      case "rural":
        return zoom.zoomLevel >= zoomLevels.maxedIn
          ? DrawingHelper.drawCircle(ctx, coordinate, 2, color)
          : skip();
      case "town":
        return zoom.zoomLevel >= zoomLevels.strongIn
          ? DrawingHelper.drawSquare(ctx, coordinate, 4, color)
          : skip();
      case "city":
        return zoom.zoomLevel >= zoomLevels.lightIn
          ? DrawingHelper.drawPentagon(ctx, coordinate, 8, color)
          : skip();
      default:
        return;
    }
  }

  private drawConstructibles(gameState: IGameState, zoom: IZoomState): null {
    this.canvasRecord["constructibles"].clearRect(
      0,
      0,
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const allOwnedLocations = gameState.ownedLocations;
    const drawCallbacks: Array<() => void> = [];

    // Draw all constructibles in one batch
    for (const [locationIdentifier, constructible] of Object.entries(
      allOwnedLocations,
    )) {
      const locationCoordinates =
        this.gameData?.locationDataMap[locationIdentifier].centerCoordinates;

      if (locationCoordinates) {
        const { x, y } = locationCoordinates;
        const level = constructible.rank;
        drawCallbacks.push(() =>
          this.drawLocation(
            this.canvasRecord["constructibles"],
            level,
            zoom,
            { x, y },
            gameState.capitalLocation === locationIdentifier,
          ),
        );
      }
    }

    DrawingHelper.draw([this.canvasRecord["constructibles"]], drawCallbacks);
    return null;
  }

  private drawRoads(gameState: IGameState): null {
    if (!this.gameData) {
      return null;
    }

    this.canvasRecord["roads"].clearRect(
      0,
      0,
      this.mapInfos.width,
      this.mapInfos.height,
    );

    const resolvedRoads = RoadsHelper.getRoads(
      this.gameData.roads,
      gameState.roads,
    );
    const roadsToDraw = ObjectHelper.getTypedEntries(resolvedRoads).filter(
      ([, type]) => type != null,
    );

    const drawCallbacks: Array<() => void> = [
      () => this.canvasRecord["roads"].beginPath(),
    ];
    for (const [key, type] of roadsToDraw) {
      const [from, to] = key.split("-");
      const fromCoordinates =
        this.gameData.locationDataMap[from].centerCoordinates;
      const toCoordinates = this.gameData.locationDataMap[to].centerCoordinates;
      if (fromCoordinates && toCoordinates) {
        const roadColor = ColorHelper.getRoadHexColor(type);
        drawCallbacks.push(() =>
          DrawingHelper.drawLine(this.canvasRecord["roads"], {
            canvasCoordFrom: fromCoordinates,
            canvasCoordTo: toCoordinates,
            lineWidth: 1,
            color: roadColor,
          }),
        );
      }
    }
    DrawingHelper.draw([this.canvasRecord["roads"]], drawCallbacks);
    return null;
  }

  private drawHighlighted(
    locations: ILocationIdentifier[],
  ): ILocationIdentifier[] {
    const toHighlight: Record<ILocationIdentifier, ICoordinate[]> = {};
    const missingCoordinates: ILocationIdentifier[] = [];

    const colorSearchResult = colorSearchController.getSnapshot().result;
    for (const location of locations) {
      const coords = colorSearchResult[location]?.coordinates;

      if (!coords?.length) {
        missingCoordinates.push(location);
      } else {
        toHighlight[location] = coords;
      }
    }

    if (missingCoordinates.length > 0) {
      colorSearchController.requestColorSearch(missingCoordinates);
    }

    DrawingHelper.draw(
      [this.canvasRecord["indicators"]],
      [
        () =>
          this.canvasRecord["indicators"].clearRect(
            0,
            0,
            this.mapInfos.width,
            this.mapInfos.height,
          ),
        () =>
          DrawingHelper.drawHighlights(
            this.canvasRecord["indicators"],
            Object.values(toHighlight),
          ),
      ],
    );

    return missingCoordinates;
  }

  private drawMaritimePresence(
    maritimePresenceData: Record<
      ILocationIdentifier,
      { maritimePresence?: number }
    >,
  ): ILocationIdentifier[] {
    const toHighlight: Record<
      ILocationIdentifier,
      { coordinates: ICoordinate[]; maritimePresence?: number }
    > = {};
    const missingCoordinates: ILocationIdentifier[] = [];

    const colorSearchResult = colorSearchController.getSnapshot().result;
    for (const [location, { maritimePresence }] of Object.entries(
      maritimePresenceData,
    )) {
      const coords = colorSearchResult[location]?.coordinates;
      if (!coords?.length) {
        missingCoordinates.push(location);
      } else {
        toHighlight[location] = { coordinates: coords, maritimePresence };
      }
    }

    if (missingCoordinates.length > 0) {
      colorSearchController.requestColorSearch(missingCoordinates);
    }

    DrawingHelper.draw(
      [this.canvasRecord["maritimePresences"]],
      [
        () =>
          this.canvasRecord["maritimePresences"].clearRect(
            0,
            0,
            this.mapInfos.width,
            this.mapInfos.height,
          ),
        ...Object.values(toHighlight)
          .filter(({ maritimePresence }) => !!maritimePresence)
          .map(
            ({ coordinates, maritimePresence }) =>
              () =>
                DrawingHelper.drawHighlights(
                  this.canvasRecord["maritimePresences"],
                  [coordinates],
                  (presence: unknown) => {
                    const t =
                      Math.max(0, Math.min(100, Number(presence) ?? 0)) / 100;
                    const r = Math.round(12 + (2 - 12) * t);
                    const g = Math.round(6 + (166 - 6) * t);
                    const b = Math.round(183 + (255 - 183) * t);
                    return `rgba(${r}, ${g}, ${b}, 0.5)`;
                  },
                  [maritimePresence],
                ),
          ),
      ],
    );

    return missingCoordinates;
  }
}
