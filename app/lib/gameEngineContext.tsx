"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { LoadingScreenComponent } from "../components/loadingScreen.component";
import type { GameDataVersion } from "../config/gameData.config";
import { GameEngine, GameEngineDomRefs, ImagePaths } from "./gameEngine";
import { Observable } from "./observable";
import type { GameData } from "./types/general";

const GameEngineContext = createContext<GameEngine | null>(null);

export function useGameEngine(): GameEngine {
  const engine = useContext(GameEngineContext);
  if (!engine)
    throw new Error("useGameEngine must be used within GameEngineProvider");
  return engine;
}

type ObservableKey = {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof GameEngine]: GameEngine[K] extends Observable<any> ? K : never;
}[keyof GameEngine];

type ObservableValue<K extends ObservableKey> =
  GameEngine[K] extends Observable<infer T> ? T : never;

export function useModel<K extends ObservableKey>(key: K): ObservableValue<K> {
  const engine = useGameEngine();
  const model = engine[key] as unknown as Observable<ObservableValue<K>>;
  return useSyncExternalStore(model.subscribe.bind(model), () =>
    model.getSnapshot(),
  );
}

export function useHoveredLocation() {
  const { actionEventsController } = useGameEngine();
  return useSyncExternalStore(
    actionEventsController.hoveredLocation.subscribe.bind(
      actionEventsController.hoveredLocation,
    ),
    () => actionEventsController.hoveredLocation.getSnapshot(),
  );
}

export function GameEngineProvider({
  gameData,
  imagePaths,
  version,
  domRefs,
  loadFileOnStart,
  children,
}: {
  gameData: GameData;
  imagePaths: ImagePaths;
  version: GameDataVersion;
  domRefs: GameEngineDomRefs;
  loadFileOnStart: string | null;
  children: React.ReactNode;
}) {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [error, setError] = useState<string | null>(null);

  console.log("game engine provider render");

  useEffect(() => {
    let disposed = false;
    let engine: GameEngine | null = null;

    async function run() {
      try {
        engine = new GameEngine(gameData, version);
        await engine.init(domRefs, imagePaths);
        if (disposed) return;

        if (loadFileOnStart) {
          const response = await fetch(`/saves/${loadFileOnStart}`);
          const text = await response.text();
          engine.gameStateController.loadFile(text, version);
          const capitalLocation =
            engine.gameStateController.getSnapshot().capitalLocation;
          if (capitalLocation) {
            engine.cameraController.panToLocation(gameData, capitalLocation);
          }
        }
        setEngine(engine);
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e));
      }
    }

    run();

    return () => {
      disposed = true;
      engine?.dispose();
      setEngine(null);
    };
  }, [gameData, version, domRefs, imagePaths, loadFileOnStart]);

  if (error) return <LoadingScreenComponent message={error} error />;
  if (!engine) return <LoadingScreenComponent message="Loading map..." />;

  return (
    <GameEngineContext.Provider value={engine}>
      {children}
    </GameEngineContext.Provider>
  );
}
