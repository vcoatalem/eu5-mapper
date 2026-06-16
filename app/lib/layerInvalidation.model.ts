"use client";

import { Observable } from "@/app/lib/observable";
import { ObservableCombiner } from "@/app/lib/observableCombiner";
import { ColorSearchModel } from "@/app/lib/colorSearch.model";
import { GameStateModel } from "@/app/lib/gameState.model";
import { ProximityComputationModel } from "@/app/lib/proximityComputation.model";
import { CameraController } from "@/app/lib/cameraController";
import { ActionEventDispatcher } from "@/app/lib/actionEventDispatcher";
import {
  EditModeModel,
  roadSliceFromState,
  maritimeSliceFromState,
} from "@/app/lib/editMode.model";
import { TileBucketIndex } from "@/app/lib/tiling/tileBucketIndex";
import { LayerName, MapPoint, asMap } from "@/app/lib/types/coordinateSpaces";
import { LocationIdentifier, GameData } from "@/app/lib/types/general";
import { GameState } from "@/app/lib/types/gameState";
import { RoadsHelper } from "@/app/lib/roads.helper";
import { IZoomState } from "@/app/lib/cameraController";
import { ITemporaryLocationData } from "@/app/lib/types/temporaryLocationData";
import { ResolvedRoad } from "@/app/lib/types/renderTypes";
export type { ResolvedRoad } from "@/app/lib/types/renderTypes";

function computeHighlights(
  hover: { locations: LocationIdentifier[] },
  prolongedHover: { locations: LocationIdentifier[] },
  editMode: ReturnType<EditModeModel["getSnapshot"]>,
): LocationIdentifier[] {
  const roadSlice = roadSliceFromState(editMode);
  const maritimeSlice = maritimeSliceFromState(editMode);
  return Array.from(
    new Set([
      ...(roadSlice.isModeEnabled && roadSlice.selectedLocation
        ? [roadSlice.selectedLocation]
        : []),
      ...(maritimeSlice.isModeEnabled && maritimeSlice.selectedLocation
        ? [maritimeSlice.selectedLocation]
        : []),
      ...(hover?.locations ?? []),
      ...(prolongedHover?.locations ?? []),
    ]),
  ).sort();
}

export class LayerInvalidationModel extends Observable<{
  dirty: Set<LayerName>;
}> {
  private buckets = new TileBucketIndex();
  private resolvedRoads: ResolvedRoad[] = [];
  private highlightSet: LocationIdentifier[] = [];
  private gameData: GameData | null = null;
  private subs: Array<() => void> = [];

  constructor(
    private colorSearch: ColorSearchModel,
    private gameState: GameStateModel,
    private editMode: EditModeModel,
    private camera: CameraController,
    private proximity: ProximityComputationModel,
    private actionEvents: ActionEventDispatcher,
  ) {
    super();
  }

  init(gameData: GameData): void {
    this.dispose();
    if (gameData !== this.gameData) {
      this.buckets = new TileBucketIndex();
    }
    this.gameData = gameData;

    this.subs.push(
      this.colorSearch.subscribe(({ completedLocations }) => {
        for (const { loc, coords } of completedLocations) {
          this.buckets.ingest(loc, coords.map(asMap));
        }
        this.markDirty("areas", "indicators", "maritimePresences");
      }),
    );

    const gameStateCombiner = new ObservableCombiner([
      this.gameState,
      this.proximity,
    ]);
    this.subs.push(gameStateCombiner.dispose.bind(gameStateCombiner));
    this.subs.push(
      gameStateCombiner.debounce(10).subscribe(({ values: [gameState] }) => {
        this.ensureCoordsFor(Object.keys(gameState.ownedLocations));
        this.resolvedRoads = this.resolveRoads(gameState);
        this.markDirty("areas", "roads", "maritimePresences");
      }),
    );

    const constructibleCombiner = new ObservableCombiner([
      this.gameState,
      this.camera,
    ]);
    this.subs.push(constructibleCombiner.dispose.bind(constructibleCombiner));
    this.subs.push(
      constructibleCombiner
        .debounce(10)
        .subscribe(() => this.markDirty("constructibles")),
    );

    const indicatorsCombiner = new ObservableCombiner([
      this.actionEvents.hoveredLocation,
      this.actionEvents.prolongedHoverLocation,
      this.editMode,
    ]);
    this.subs.push(indicatorsCombiner.dispose.bind(indicatorsCombiner));
    this.subs.push(
      indicatorsCombiner.subscribe(
        ({ values: [hover, prolonged, editMode] }) => {
          this.highlightSet = computeHighlights(
            hover as { locations: LocationIdentifier[] },
            prolonged as { locations: LocationIdentifier[] },
            editMode as ReturnType<EditModeModel["getSnapshot"]>,
          );
          this.ensureCoordsFor(this.highlightSet);
          this.markDirty("indicators");
        },
      ),
    );
  }

  private ensureCoordsFor(locs: LocationIdentifier[]): void {
    const missing = locs.filter((l) => !this.buckets.has(l));
    if (missing.length) this.colorSearch.requestColorSearch(missing);
  }

  private resolveRoads(gameState: GameState): ResolvedRoad[] {
    const gameData = this.gameData;
    if (!gameData) return [];
    return Object.entries(RoadsHelper.getRoads(gameData.roads, gameState.roads))
      .filter(([, type]) => type != null)
      .flatMap(([key, type]) => {
        const [fromLoc, toLoc] = key.split("-");
        const from = gameData.locationDataMap[fromLoc]?.centerCoordinates;
        const to = gameData.locationDataMap[toLoc]?.centerCoordinates;
        if (!from || !to) return [];
        return [{ from: asMap(from), to: asMap(to), type }];
      });
  }

  tileBucket(key: string): Map<LocationIdentifier, MapPoint[]> | undefined {
    return this.buckets.getByTile(key);
  }
  locationCoords(loc: LocationIdentifier): MapPoint[] {
    return this.buckets.coordsOf(loc);
  }
  locationCenter(loc: LocationIdentifier): MapPoint | null {
    const c = this.gameData?.locationDataMap[loc]?.centerCoordinates;
    return c ? asMap(c) : null;
  }
  ownedLocations(): GameState["ownedLocations"] {
    return this.gameState.getSnapshot().ownedLocations;
  }
  capitalLocation(): string | undefined {
    return this.gameState.getSnapshot().capitalLocation;
  }
  proximityCost(loc: LocationIdentifier): number {
    return (
      this.proximity.getSnapshot().result?.[loc]?.cost ?? -1
    );
  }
  temporaryLocationData(
    loc: LocationIdentifier,
  ): ITemporaryLocationData | undefined {
    return this.gameState.getSnapshot().temporaryLocationData?.[loc];
  }
  currentZoom(): IZoomState {
    return this.camera.getSnapshot();
  }
  roads(): ResolvedRoad[] {
    return this.resolvedRoads;
  }
  highlights(): LocationIdentifier[] {
    return this.highlightSet;
  }

  private markDirty(...layers: LayerName[]): void {
    this.subject = { dirty: new Set(layers) };
    this.notifyListeners();
  }

  dispose(): void {
    this.subs.forEach((u) => u());
    this.subs = [];
  }
}
