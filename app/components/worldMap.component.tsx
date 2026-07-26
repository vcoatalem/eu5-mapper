"use client";

import React, {
  useContext,
  useMemo,
  useRef,
} from "react";


import { InfoBoxComponent } from "./infoBox.component";
import { AppContext } from "../appContextProvider";
import { SimpleLocationList } from "./simpleLocationlist.component";
import { GuiElement } from "./guiElement";
import { worldMapConfig } from "./worldMap.config";
import { NeighborsPanelComponent } from "./neighborsPanel.component";
import { HeaderComponent } from "./header.component";
import { CountryOverview } from "./countryOverview.component";
import { MainActionsBar } from "./mainActionsBar.component";
import { RoadList } from "./roads/roadList.component";
import { SlowTaskIndicator } from "@/app/components/slowTaskIndicator.component";
import { LocationSearchBar } from "@/app/components/locationSearchBar.component";
import { CountryStats } from "@/app/components/countryStatsComponent";
import {
  HiOutlineMagnifyingGlassMinus,
  HiOutlineMagnifyingGlassPlus,
} from "react-icons/hi2";
import { LayerVisibilityEdition } from "@/app/components/layerVisibilityEdition.component";
import { Tooltip } from "../lib/tooltip/tooltip.component";
import { TooltipContent } from "../lib/tooltip/tooltipContent.component";
import { useSearchParams } from "next/navigation";
import { useGameDataVersion } from "@/app/[version]/version.guard";
import { LoadingScreenComponent } from "@/app/components/loadingScreen.component";
import { GameEngineProvider, useGameEngine, useModel } from "@/app/lib/gameEngineContext";
import { roadSliceFromState } from "@/app/lib/editMode.model";

function MapOverlays() {
  const gameState = useModel("gameStateController");
  const editModeState = useModel("editModeController");
  const cameraState = useModel("cameraController");
  const selection = useModel("selectionController");
  const { cameraController } = useGameEngine();
  const { gameData } = useContext(AppContext);

  const hasOwnedLocations = !!Object.keys(gameState?.ownedLocations ?? {}).length;
  const roadBuilderState = useMemo(
    () => roadSliceFromState(editModeState),
    [editModeState],
  );

  const handleZoomOut = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    cameraController.zoomOut();
  };

  const handleZoomIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    cameraController.zoomIn();
  };

  return (
    <div>
      <GuiElement className="fixed top-2 max-h-12 left-5 right-5 z-50">
        <HeaderComponent />
      </GuiElement>
      <div className="fixed left-5 top-16 flex flex-col gap-2 z-50 max-h-[80vh] min-h-0">
        {hasOwnedLocations && (
          <>
            <GuiElement className="flex-none w-72">
              <CountryStats ownedLocations={gameState?.ownedLocations ?? {}} />
            </GuiElement>
            <GuiElement
              className="flex-none w-72 overflow-y-scroll overflow-x-hidden"
              style={{ padding: 0 }}
            >
              <CountryOverview />
            </GuiElement>
            <GuiElement className="min-h-0 w-72 max-h-[60vh] shrink overflow-hidden flex flex-col">
              {roadBuilderState.isModeEnabled ? (
                <RoadList className="max-h-[60vh]" />
              ) : (
                <SimpleLocationList />
              )}
            </GuiElement>
          </>
        )}
      </div>
      <GuiElement className="fixed left-5 right-5 bottom-1">
        <InfoBoxComponent />
      </GuiElement>
      <Tooltip
        forceOpen={!!selection.location}
        mouseCoordinates={selection.mouseCoordinate || undefined}
        config={{ openDelay: 0, offset: { x: 50, y: 50 } }}
      >
        <TooltipContent
          anchor={{
            type: "coordinate",
            coordinate: gameData?.locationDataMap[selection.location!]?.centerCoordinates ?? { x: 0, y: 0 },
          }}
        >
          <div className="pointer-events-auto">
            <NeighborsPanelComponent
              baseLocation={selection.location!}
              style={cameraState.isDragging ? { opacity: 0.5 } : undefined}
            />
          </div>
        </TooltipContent>
      </Tooltip>
      <GuiElement className="fixed right-5 top-30 rounded-lg py-2">
        <LocationSearchBar className="w-52" />
      </GuiElement>
      <GuiElement className="fixed right-5 top-15 py-2 flex-none z-51">
        <MainActionsBar />
      </GuiElement>
      <SlowTaskIndicator className="fixed bottom-32 right-5 z-50 backdrop-blur-md p-4" />
      <GuiElement className="fixed right-5 bottom-17 flex flex-row gap-2">
        <LayerVisibilityEdition className="px-2 py-1" />
        <button
          onClick={handleZoomOut}
          className="px-2 py-1 hover:text-stone-500 cursor-pointer"
        >
          <HiOutlineMagnifyingGlassMinus size={24} />
        </button>
        <button
          onClick={handleZoomIn}
          className="px-2 py-1 hover:text-stone-500 cursor-pointer"
        >
          <HiOutlineMagnifyingGlassPlus size={24} />
        </button>
      </GuiElement>
    </div>
  );
}

export function WorldMapComponent() {
  const context = useContext(AppContext);
  const { gameData, imagePaths, tileUrls, error: gameDataLoadingError } = context;
  const version = useGameDataVersion();
  const loadFileOnStart = useSearchParams().get("file") as string;

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const hitSurfaceRef = useRef<HTMLDivElement>(null);
  const domRefs = useMemo(
    () => ({
      container: containerRef,
      world: worldRef,
      hitSurface: hitSurfaceRef,
    }),
    [],
  );

  if (gameDataLoadingError) {
    return <LoadingScreenComponent message={gameDataLoadingError} error />;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen"
      style={{ overflow: "hidden" }}
    >
      {/* Background fill behind the world */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#4a4a4a",
          zIndex: -1,
        }}
      />

      {/* World element: single camera-transformed container; layer divs injected by manager */}
      <div
        ref={worldRef}
        style={{
          position: "absolute",
          width: worldMapConfig.width,
          height: worldMapConfig.height,
          transformOrigin: "0 0",
        }}
      />

      {/* Hit surface: transparent overlay for map interaction */}
      <div
        ref={hitSurfaceRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 20,
        }}
      />

      {gameData && imagePaths && tileUrls ? (
        <GameEngineProvider
          gameData={gameData}
          imagePaths={imagePaths}
          tileUrls={tileUrls}
          version={version}
          domRefs={domRefs}
          loadFileOnStart={loadFileOnStart}
        >
          <MapOverlays />
        </GameEngineProvider>
      ) : (
        <LoadingScreenComponent message="Loading game data..." />
      )}
    </div>
  );
}

export default WorldMapComponent;
