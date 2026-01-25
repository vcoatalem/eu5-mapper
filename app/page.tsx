"use client";

import { LoadingScreenComponent } from "./components/loadingScreen.component";
import { WorldMapComponent } from "./components/worldMap.component";
import { GameDataRegistry } from "./lib/gameDataRegistry";

export default function Home() {
  const registry = GameDataRegistry.getInstance();
  const isLoading = registry.getIsLoading();
  const error = registry.getError();
  /* 
  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  if (isLoading) {
    return <LoadingScreenComponent />;
  } */

  return <WorldMapComponent />;
}
