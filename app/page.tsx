"use client";

import { parse } from "path";
import { Dispatch, SetStateAction, use, useEffect, useState } from "react";
import { InfoBoxComponent } from "./components/infoBox.component";

const mapInfos = {
  width: 16384,
  height: 8192,
  colorMapFileName: "test/locations.png",
  borderMapFileName: "test/locations_borders.png",
};

async function extractMappingData(): Promise<Record<string, string> | null> {
  const getData = async () => {
    try {
      const response = await fetch("test/00_default.txt");
      const data = await response.text();
      console.log(data);
      return data;
    } catch (error) {
      console.error("Failed to load mapping data:", error);
      return null;
    }
  };

  const parseInfo = (data: string): Record<string, string> => {
    const lines = data.split("\n");
    const res: Record<string, string> = {};

    for (const line of lines) {
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue; // Skip comments and empty lines
      }

      const [locationName, hexCode] = line.split("=");
      /* console.log({ locationName, hexCode }); */
      res[hexCode.trim()] = locationName.trim();
    }

    return res;
  };

  const data = await getData();
  if (!data) {
    return null;
  }
  return parseInfo(data);
}

function handleImageHover(
  colorCanvas: HTMLCanvasElement,
  mapping: Record<string, string>,
  event: MouseEvent,
  dispatchFn: Dispatch<SetStateAction<string>>
) {
  /* console.log("handleImageHover", event); */

  //TODO: make sure colorCanvas and borderCanvas getBoundingClientRect are the same
  const rect = colorCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const imageData = colorCanvas
    .getContext("2d")
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
  /*  console.log({
    x,
    y,
    rgbStr: hexStr,
    locationName: mapping[hexStr] || "Unknown location",
  }); */
}

export default function Home() {
  const [mappingData, setMappingData] = useState<Record<string, string> | null>(
    null
  );

  const [hoveredLocation, setHoveredLocation] = useState<string>("");

  useEffect(() => {
    extractMappingData().then((data) => setMappingData(data));
  }, []);

  useEffect(() => {
    if (!mappingData) {
      console.log("need to load mapping data first");
      return;
    }

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

      /*  colorCanvas.addEventListener("mousemove", (event) =>
        handleImageHover(colorCanvas, mappingData, event)
      ); */
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

      borderCanvas.addEventListener("mousemove", (event) =>
        handleImageHover(colorCanvas, mappingData, event, setHoveredLocation)
      );
    }
  }, [mappingData]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
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
        <InfoBoxComponent locationName={hoveredLocation} />
      </div>
    </div>
  );
}
