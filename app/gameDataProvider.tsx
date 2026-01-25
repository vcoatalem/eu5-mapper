"use server";

import { ReactNode } from "react";
import { readFile } from "fs/promises";
import { join } from "path";
import { ILocationDataMap } from "./lib/types";
import { GameDataClientProvider } from "./gameDataContext";
import { GameDataParser } from "./lib/gameDataParser";

interface GameDataProviderProps {
  children: ReactNode;
  locationDataPath?: string;
}

export async function GameDataProvider({
  children,
  locationDataPath = "game_data/locations_color_mapping/0.0.11/00_default.txt",
}: GameDataProviderProps) {
  let gameData: ILocationDataMap | null = null;
  let error: string | null = null;

  try {
    const filePath = join(process.cwd(), locationDataPath);
    const fileContent = await readFile(filePath, "utf-8");

    gameData = GameDataParser.parseLocationData(fileContent);

    if (!gameData) {
      throw new Error("Failed to load game data");
    }
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Unknown error loading game data";
    console.error("[GameDataProvider] Error loading data:", error);
  }

  return (
    <GameDataClientProvider value={{ gameData, error }}>
      {children}
    </GameDataClientProvider>
  );
}
