import { AppContext } from "@/app/appContextProvider";
import { Loader } from "@/app/components/loader.component";
import { GameDataLoaderHelper } from "@/app/lib/gameDataLoader.helper";
import { colorSearchController } from "@/app/lib/colorSeach.controller";
import { LocationIdentifier } from "@/app/lib/types/general";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  const colorSearchResult = useSyncExternalStore(
    colorSearchController.subscribe.bind(colorSearchController),
    () => colorSearchController.getSnapshot(),
  );

  const version = useParams().version as string;
  const [terrainLayerImagePath, setTerrainLayerImagePath] = useState<
    string | null
  >(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const terrainImageRef = useRef<HTMLImageElement | null>(null);
  const [terrainRendered, setTerrainRendered] = useState(false);

  const coordinatesToColor = useMemo(() => {
    if (!colorSearchResult.result) {
      return [];
    }
    const coordinates: Array<{ x: number; y: number }> = [];
    for (const location of props.countryLocations) {
      if (colorSearchResult.result[location]?.coordinates) {
        coordinates.push(...colorSearchResult.result[location].coordinates);
      }
    }
    return coordinates;
  }, [colorSearchResult, props.countryLocations]);

  useEffect(() => {
    if (!colorSearchResult.result || props.countryLocations.length === 0)
      return;
    const missing = props.countryLocations.filter(
      (loc) => !colorSearchResult.result![loc]?.coordinates,
    );
    if (missing.length > 0) {
      colorSearchController.requestColorSearch(missing);
    }
  }, [colorSearchResult, props.countryLocations]);

  const { gameData } = useContext(AppContext);

  const capitalCoordinates = useMemo(() => {
    if (!gameData || !props.capitalLocation) return null;
    return gameData.locationDataMap[props.capitalLocation]?.centerCoordinates;
  }, [gameData, props.capitalLocation]);

  const drawTerrain = useCallback(() => {
    const canvas = canvasRef.current;
    const img = terrainImageRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
    if (!canvasRef.current) return;
    queueMicrotask(() => setTerrainRendered(false));
    canvasRef.current.width = CANVAS_WIDTH;
    canvasRef.current.height = CANVAS_HEIGHT;
    drawTerrain();

    GameDataLoaderHelper.loadManifestForVersion(version).then((manifest) => {
      const terrainLayerPath = GameDataLoaderHelper.getFileUrlForVersion(
        version,
        "terrainLayer",
        manifest,
      );
      setTerrainLayerImagePath(terrainLayerPath);
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = terrainLayerPath;
      img.onload = () => {
        setTerrainRendered(true);
        terrainImageRef.current = img;
        drawTerrain();
      };
    });
  }, [version, drawTerrain]);

  useEffect(() => {
    drawTerrain();
  }, [capitalCoordinates, drawTerrain]);

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas || !capitalCoordinates) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
        >
          {terrainLayerImagePath && (
            <Image
              src={terrainLayerImagePath}
              alt="terrain layer"
              width={300}
              height={200}
            />
          )}
        </canvas>
        {!terrainRendered && (
          <div className="absolute inset-0 flex items-center justify-center z-2 bg-stone-900/80">
            <Loader className="mx-auto" size={32} />
          </div>
        )}
      </div>
    </div>
  );
}
