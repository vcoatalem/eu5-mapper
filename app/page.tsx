"use client";

import { useContext, useEffect } from "react";
import { AppContext } from "./app-context-provider";
import { LoadingScreenComponent } from "./components/loadingScreen.component";
import { WorldMapComponent } from "./components/worldMap.component";

async function extractMappingData(): Promise<Record<string, string> | null> {
  const getData = async () => {
    try {
      const response = await fetch("test/00_default.txt");
      const data = await response.text();
      /* console.log(data); */
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
        continue;
      }

      const [locationName, rest] = line.split("=");
      if (!locationName || !rest) continue;

      const hexCode = rest.split("#")[0].trim();
      if (!hexCode) continue;

      res[hexCode] = locationName.trim();
    }

    return res;
  };

  const data = await getData();
  if (!data) {
    return null;
  }
  return parseInfo(data);
}

export default function Home() {
  const { mappingData, setMappingData } = useContext(AppContext);

  useEffect(() => {
    extractMappingData().then((data) => {
      setMappingData(data);
    });
  }, []);
  return !mappingData ? <LoadingScreenComponent /> : <WorldMapComponent />;
}
