"use client";

import { createContext, useContext, ReactNode } from "react";
import {
  IBuildingTemplate,
  ILocationDataMap,
  ILocationIdentifierMap,
} from "./lib/types";

interface GameDataContextType {
  locationDataMap: ILocationDataMap | null;
  colorToNameMap: ILocationIdentifierMap;
  buildingsTemplateMap: Record<string, IBuildingTemplate>;
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
