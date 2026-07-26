import { AppContext } from "@/app/appContextProvider";
import { COLS, ROWS, TILE_SIZE } from "@/app/components/worldMap.config";
import { useGameEngine } from "@/app/lib/gameEngineContext";
import { getTileImage } from "@/app/lib/tiling/tileImageCache";
import { useTileLoadingOverlay } from "@/app/lib/tiling/tileLoadingOverlay";
import { makeTileId, mapToTileId, tileOrigin } from "@/app/lib/tiling/tileMath";
import { Coordinate } from "@/app/lib/types/coordinate";
import { asMap, TileId } from "@/app/lib/types/coordinateSpaces";
import { LocationIdentifier } from "@/app/lib/types/general";
import { get2dContext } from "@/app/lib/utils/canvasUtils";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DISPLAY_SIZE = 400;
const HEADER_SIZE = 20; // reserved margin for col/row index labels
const GRID_AREA_SIZE = DISPLAY_SIZE - HEADER_SIZE;
const SMALL_COUNTRY_LOCATION_THRESHOLD = 25;

/** Transforms a world map coordinate to grid-area pixel. Returns null if outside the grid. */
function worldToMinimapCanvas(
  worldX: number,
  worldY: number,
  originX: number,
  originY: number,
  viewSize: number,
): { x: number; y: number } | null {
  const px = ((worldX - originX) / viewSize) * GRID_AREA_SIZE;
  const py = ((worldY - originY) / viewSize) * GRID_AREA_SIZE;
  if (px < 0 || px >= GRID_AREA_SIZE || py < 0 || py >= GRID_AREA_SIZE) {
    return null;
  }
  return { x: Math.floor(px), y: Math.floor(py) };
}

function MinimapTileCell({ url, cellSize }: { url: string; cellSize: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { remove: removeLoadingOverlay, markError: markOverlayError } =
    useTileLoadingOverlay(containerRef, cellSize);

  useEffect(() => {
    let cancelled = false;
    getTileImage(url)
      .then((bitmap) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (canvas) get2dContext(canvas).drawImage(bitmap, 0, 0);
        removeLoadingOverlay();
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[CountrySelectionMinimap] tile fetch failed", url, err);
        markOverlayError();
      });
    return () => {
      cancelled = true;
    };
  }, [url, removeLoadingOverlay, markOverlayError]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full border border-white border-dashed opacity-50"
    >
      <canvas
        ref={canvasRef}
        width={TILE_SIZE}
        height={TILE_SIZE}
        className="block w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}

interface ICountrySelectionMinimapProps {
  capitalLocation: LocationIdentifier;
  countryLocations: LocationIdentifier[];
  className?: string;
}

export function CountrySelectionMinimap(props: ICountrySelectionMinimapProps) {
  const { colorSearchController } = useGameEngine();
  const { gameData, tileUrls } = useContext(AppContext);

  // Accumulate color-search deltas into a per-location coordinate map
  const [locationCoordsMap, setLocationCoordsMap] = useState<
    Map<LocationIdentifier, Coordinate[]>
  >(() => new Map());

  useEffect(() => {
    const missing = props.countryLocations.filter(
      (loc) => !locationCoordsMap.has(loc),
    );
    if (missing.length > 0) colorSearchController.requestColorSearch(missing);

    return colorSearchController.subscribe(({ completedLocations }) => {
      setLocationCoordsMap((prev) => {
        const next = new Map(prev);
        for (const { loc, coords } of completedLocations) next.set(loc, coords);
        return next;
      });
    });
  }, [props.countryLocations, colorSearchController, locationCoordsMap]);

  const coordinatesToColor = useMemo(() => {
    const coordinates: Coordinate[] = [];
    for (const location of props.countryLocations) {
      const coords = locationCoordsMap.get(location);
      if (coords) coordinates.push(...coords);
    }
    return coordinates;
  }, [locationCoordsMap, props.countryLocations]);

  const capitalCoordinates = useMemo(() => {
    if (!gameData || !props.capitalLocation) return null;
    return gameData.locationDataMap[props.capitalLocation]?.centerCoordinates;
  }, [gameData, props.capitalLocation]);

  const gridSize =
    props.countryLocations.length < SMALL_COUNTRY_LOCATION_THRESHOLD ? 3 : 5;

  const grid = useMemo(() => {
    if (!capitalCoordinates) return null;
    const center = mapToTileId(asMap(capitalCoordinates));
    const half = Math.floor(gridSize / 2);
    const colStart = Math.max(0, Math.min(center.col - half, COLS - gridSize));
    const rowStart = Math.max(0, Math.min(center.row - half, ROWS - gridSize));

    const tiles: TileId[] = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        tiles.push(makeTileId(colStart + c, rowStart + r));
      }
    }
    const origin = tileOrigin(makeTileId(colStart, rowStart));
    const viewSize = gridSize * TILE_SIZE;
    return { tiles, origin, viewSize };
  }, [capitalCoordinates, gridSize]);

  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  const drawDots = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas || !grid) return;
    const ctx = get2dContext(canvas);
    ctx.clearRect(0, 0, GRID_AREA_SIZE, GRID_AREA_SIZE);
    if (coordinatesToColor.length === 0) return;

    ctx.fillStyle = "#ffffff";
    for (const coord of coordinatesToColor) {
      const pixel = worldToMinimapCanvas(
        coord.x,
        coord.y,
        grid.origin.x,
        grid.origin.y,
        grid.viewSize,
      );
      if (pixel) ctx.fillRect(pixel.x, pixel.y, 1, 1);
    }
  }, [coordinatesToColor, grid]);

  useEffect(() => {
    drawDots();
  }, [drawDots]);

  return (
    <div
      className={`${props.className} block relative`}
      style={{ width: `${DISPLAY_SIZE}px`, height: `${DISPLAY_SIZE}px` }}
    >
      <div
        className="relative bg-black"
        style={{ width: `${DISPLAY_SIZE}px`, height: `${DISPLAY_SIZE}px` }}
      >
        {grid && tileUrls && (
          <>
            {/* Column indices, aligned above the grid area */}
            <div
              className="absolute top-0 grid text-white text-[9px] font-mono leading-none"
              style={{
                left: HEADER_SIZE,
                width: GRID_AREA_SIZE,
                height: HEADER_SIZE,
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              }}
            >
              {grid.tiles.slice(0, gridSize).map((tile) => (
                <span key={tile.col} className="grid place-items-center">
                  {tile.col}
                </span>
              ))}
            </div>

            {/* Row indices, aligned left of the grid area */}
            <div
              className="absolute left-0 grid text-white text-[9px] font-mono leading-none"
              style={{
                top: HEADER_SIZE,
                width: HEADER_SIZE,
                height: GRID_AREA_SIZE,
                gridTemplateRows: `repeat(${gridSize}, 1fr)`,
              }}
            >
              {Array.from(
                { length: gridSize },
                (_, r) => grid.tiles[r * gridSize].row,
              ).map((row, index) => (
                <span key={index} className="grid place-items-center">
                  {row}
                </span>
              ))}
            </div>

            <div
              className="absolute grid"
              style={{
                top: HEADER_SIZE,
                left: HEADER_SIZE,
                width: GRID_AREA_SIZE,
                height: GRID_AREA_SIZE,
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                gridTemplateRows: `repeat(${gridSize}, 1fr)`,
              }}
            >
              {grid.tiles.map((tile) => (
                <MinimapTileCell
                  key={`${tile.col}_${tile.row}`}
                  url={tileUrls.terrain[tile.row][tile.col]}
                  cellSize={GRID_AREA_SIZE / gridSize}
                />
              ))}
            </div>
          </>
        )}
        <canvas
          ref={drawCanvasRef}
          width={GRID_AREA_SIZE}
          height={GRID_AREA_SIZE}
          className="block absolute z-10 pointer-events-none"
          style={{ top: HEADER_SIZE, left: HEADER_SIZE }}
        />
      </div>
    </div>
  );
}
