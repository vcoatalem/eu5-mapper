import { AppContext } from "@/app/appContextProvider";
import { Loader } from "@/app/components/loader.component";
import { useGameEngine } from "@/app/lib/gameEngineContext";
import { Coordinate } from "@/app/lib/types/coordinate";
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

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 200;

/** Transforms a world map coordinate to canvas pixel. Returns null if outside the minimap viewport. */
function worldToCanvas(
  worldX: number,
  worldY: number,
  capitalX: number,
  capitalY: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } | null {
  const sx = capitalX - viewW / 2;
  const sy = capitalY - viewH / 2;
  const px = ((worldX - sx) / viewW) * CANVAS_WIDTH;
  const py = ((worldY - sy) / viewH) * CANVAS_HEIGHT;
  if (px < 0 || px >= CANVAS_WIDTH || py < 0 || py >= CANVAS_HEIGHT) {
    return null;
  }
  return { x: Math.floor(px), y: Math.floor(py) };
}

interface ICountrySelectionMinimapProps {
  capitalLocation: LocationIdentifier;
  countryLocations: LocationIdentifier[];
  className?: string;
  viewW: number;
  viewH: number;
}

export function CountrySelectionMinimap(props: ICountrySelectionMinimapProps) {
  const { colorSearchController } = useGameEngine();
  // Accumulate color-search deltas into a per-location coordinate map
  const [locationCoordsMap, setLocationCoordsMap] = useState<
    Map<LocationIdentifier, Coordinate[]>
  >(() => new Map());

  useEffect(() => {
    // Request coords for any locations not yet known
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const terrainImageRef = useRef<HTMLImageElement | null>(null);
  const [terrainRendered, setTerrainRendered] = useState(false);

  const coordinatesToColor = useMemo(() => {
    const coordinates: Coordinate[] = [];
    for (const location of props.countryLocations) {
      const coords = locationCoordsMap.get(location);
      if (coords) coordinates.push(...coords);
    }
    return coordinates;
  }, [locationCoordsMap, props.countryLocations]);

  const { gameData, imagePaths } = useContext(AppContext);

  const capitalCoordinates = useMemo(() => {
    if (!gameData || !props.capitalLocation) return null;
    return gameData.locationDataMap[props.capitalLocation]?.centerCoordinates;
  }, [gameData, props.capitalLocation]);

  const drawTerrain = useCallback(() => {
    const canvas = canvasRef.current;
    const img = terrainImageRef.current;
    if (!canvas) return;
    const ctx = get2dContext(canvas);

    const { viewW, viewH } = props;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!img || !img.complete || !capitalCoordinates) return;

    const { x: cx, y: cy } = capitalCoordinates;
    const sx = cx - viewW / 2;
    const sy = cy - viewH / 2;

    const srcX = Math.max(0, sx);
    const srcY = Math.max(0, sy);
    const srcRight = Math.min(img.width, sx + viewW);
    const srcBottom = Math.min(img.height, sy + viewH);
    const srcW = srcRight - srcX;
    const srcH = srcBottom - srcY;

    if (srcW <= 0 || srcH <= 0) return;

    const dstX = ((srcX - sx) / viewW) * canvas.width;
    const dstY = ((srcY - sy) / viewH) * canvas.height;
    const dstW = (srcW / viewW) * canvas.width;
    const dstH = (srcH / viewH) * canvas.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
  }, [capitalCoordinates, props]);

  useEffect(() => {
    if (!canvasRef.current || !imagePaths) return;
    queueMicrotask(() => setTerrainRendered(false));
    canvasRef.current.width = CANVAS_WIDTH;
    canvasRef.current.height = CANVAS_HEIGHT;
    drawTerrain();

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imagePaths.terrainLayer;
    img.onload = () => {
      setTerrainRendered(true);
      terrainImageRef.current = img;
      drawTerrain();
    };
  }, [imagePaths?.terrainLayer, drawTerrain, imagePaths]);

  useEffect(() => {
    drawTerrain();
  }, [capitalCoordinates, drawTerrain]);

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas || !capitalCoordinates) return;

    const ctx = get2dContext(canvas);

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (coordinatesToColor.length === 0) return;

    const { x: cx, y: cy } = capitalCoordinates;
    ctx.fillStyle = "#ffffff";
    for (const coord of coordinatesToColor) {
      const pixel = worldToCanvas(
        coord.x,
        coord.y,
        cx,
        cy,
        props.viewW,
        props.viewH,
      );
      if (pixel) {
        ctx.fillRect(pixel.x, pixel.y, 1, 1);
      }
    }
  }, [coordinatesToColor, capitalCoordinates, props.viewW, props.viewH]);

  return (
    <div
      className={`${props.className} block relative`}
      style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` }}
    >
      <div
        className="relative"
        style={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` }}
      >
        <canvas
          ref={drawCanvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block absolute top-0 left-0 z-1"
        ></canvas>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block absolute top-0 left-0 z-0"
        />
        {!terrainRendered && (
          <div className="absolute inset-0 flex items-center justify-center z-2 bg-stone-900/80">
            <Loader className="mx-auto" size={32} />
          </div>
        )}
      </div>
    </div>
  );
}
