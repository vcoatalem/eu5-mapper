"use client";

import { useContext, useEffect } from "react";
import { AppContext } from "./appContextProvider";
import { LoadingScreenComponent } from "./components/loadingScreen.component";
import { WorldMapComponent } from "./components/worldMap.component";
import { ILocationDataMap, ILocationGameData } from "./lib/types";

async function extractMappingData(): Promise<ILocationDataMap> {
  const getData = async (): Promise<string | null> => {
    try {
      const response = await fetch("test/00_default.txt");
      const data = await response.text();
      return data;
    } catch (error) {
      console.error("Failed to load mapping data:", error);
      return null;
    }
  };

  const parseInfo = (data: string): ILocationDataMap => {
    const lines = data.split("\n");
    const res: ILocationDataMap = {};

    for (const line of lines) {
      if (line.trim().startsWith("#") || line.trim() === "") {
        continue;
      }

      const [locationName, rest] = line.split("=");
      if (!locationName || !rest) continue;

      const hexCode = rest.split("#")[0].trim();
      if (!hexCode) continue;

      res[hexCode] = {
        name: locationName.trim(),
      };
    }

    return res;
  };

  const data = await getData();
  if (!data) {
    throw new Error("could not get game data");
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
