import { Dispatch, SetStateAction, useContext, useEffect } from "react";
import { InfoBoxComponent } from "./infoBox.component";
import { AppContext } from "../app-context-provider";

const mapInfos = {
  width: 16384,
  height: 8192,
  colorMapFileName: "test/locations.png",
  borderMapFileName: "test/locations_borders.png",
};

function handleMouseEvent(
  colorCanvas: HTMLCanvasElement,
  mapping: Record<string, string>,
  event: MouseEvent,
  dispatchFn: Dispatch<SetStateAction<string | null>>
) {
  /* console.log("handleImageHover", event); */

  //TODO: make sure colorCanvas and borderCanvas getBoundingClientRect are the same
  const rect = colorCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const imageData = colorCanvas
    .getContext("2d", { willReadFrequently: true })
    ?.getImageData(x, y, mapInfos.width, mapInfos.height);

  if (!imageData) {
    console.log("no image data at coordinates", { x, y });
    return;
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

  const locationName = mapping[hexStr] || "??";

  if (locationName === "??") {
    console.log("could not find hex code for color", hexStr);
  }
  dispatchFn(locationName);
}

export function WorldMapComponent() {
  const { setSelectedLocation, mappingData } = useContext(AppContext);
  if (!setSelectedLocation || !mappingData) {
    throw new Error("context is not set up properly");
  }

  useEffect(() => {
    const colorCanvas = document.getElementById(
      "color_map"
    ) as HTMLCanvasElement;
    if (colorCanvas) {
      console.log("found canvas element", colorCanvas);
      const ctx = colorCanvas.getContext("2d");

      if (!ctx) {
        console.log("canvas context is nullish");
        return;
      }

      const img = new Image();
      img.src = mapInfos.colorMapFileName;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
    } else {
      console.log("could not find color map canvas element element");
    }

    const borderCanvas = document.getElementById(
      "border_map"
    ) as HTMLCanvasElement;
    if (borderCanvas) {
      console.log("found border canvas element", borderCanvas);
      const ctx = borderCanvas.getContext("2d");

      if (!ctx) {
        console.log("border canvas context is nullish");
        return;
      }

      const img = new Image();
      img.src = mapInfos.borderMapFileName;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };

      const handleClick = (event: MouseEvent) =>
        handleMouseEvent(colorCanvas, mappingData, event, setSelectedLocation);

      borderCanvas.addEventListener("click", handleClick);

      return () => {
        borderCanvas.removeEventListener("click", handleClick);
      };
    }
  }, [setSelectedLocation, mappingData]);

  return (
    <div className="relative">
      <canvas
        className="absolute z-0"
        height={mapInfos.height}
        width={mapInfos.width}
        id="color_map"
      ></canvas>
      <canvas
        className="absolute z-1"
        height={mapInfos.height}
        width={mapInfos.width}
        id="border_map"
      ></canvas>
      <InfoBoxComponent />
    </div>
  );
}
