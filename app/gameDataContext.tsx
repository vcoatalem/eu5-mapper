"use client";

import { createContext, useContext, ReactNode } from "react";
import { ILocationDataMap } from "./lib/types";

interface GameDataContextType {
  locationDataMap: ILocationDataMap | null;
  error: string | null;
}

export const GameDataContext = createContext<GameDataContextType | null>(null);

export function useGameData(): GameDataContextType {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error("useGameData must be used within GameDataProvider");
  }
  return context;
}

interface GameDataClientProviderProps {
  children: ReactNode;
  value: GameDataContextType;
}

export function GameDataClientProvider({
  children,
  value,
}: GameDataClientProviderProps) {
  return (
    <GameDataContext.Provider value={value}>
      {children}
    </GameDataContext.Provider>
  );
}
