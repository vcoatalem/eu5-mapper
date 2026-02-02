import { JSX, useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { IGameState, ILocationGameData } from "../lib/types/general";
import { gameStateController } from "@/app/lib/gameState.controller";
import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";
import { ProximityComputationHelper } from "@/app/lib/proximityComputation.helper";

const buildLocationDisplay = (
  locationData: ILocationGameData,
  gameState: IGameState,
): JSX.Element => {
  const owned = gameState.ownedLocations[locationData?.name];

  const harborCapacity = locationData.isCoastal ? ProximityComputationHelper.getLocationHarborCapacity(locationData, gameState.ownedLocations[locationData.name], {}) : 0;
  if (!locationData) {
    return <span>No data available</span>;
  }
  return (
    <>
      <div className="flex flex-row items-center gap-6 px-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base">{locationData.name}</span>
          {!locationData.ownable && (
            <span className="text-xs text-stone-400">(Not Ownable)</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span>🏔️ {locationData.topography}</span>
          {locationData.ownable && (
            <>
              <span>📈 Dev: {locationData.development}</span>
              <span>👥 Pop: {locationData.population}</span>
              <span>{owned ? "✓ Owned" : "○ Not Owned"}</span>
            </>

          )}
          {locationData.isCoastal && locationData.ownable && <span>⚓ Capacity: {harborCapacity}</span>}
          {locationData.vegetation && <span>🌿 {locationData.vegetation}</span>}
          
 
        </div>

        {locationData.hierarchy && (
          <div className="flex items-center gap-2 text-xs text-stone-300 ml-auto">
            <span>{locationData.hierarchy.province}</span>
            <span className="text-stone-500">•</span>
            <span>{locationData.hierarchy.subcontinent}</span>
          </div>
        )}
      </div>
    </>
  );
};

export function InfoBoxComponent() {

  const gameLogic = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot()
  );

  const hoveredLocation = useSyncExternalStore(
    actionEventDispatcher.hoveredLocation.subscribe.bind(
      actionEventDispatcher.hoveredLocation,
    ),
    () => {
      return actionEventDispatcher.hoveredLocation.getSnapshot();
    },
  );


  const { gameData } = useContext(AppContext);
  if (!gameData) {
    return;
  }
  



  if (!hoveredLocation?.location) {
    return (
      <span className="h-10 bg-black/80 text-stone-400 px-4">
        Hover or select a location to view details
      </span>
    );
  }

  const locationData =
    gameData.locationDataMap?.[hoveredLocation?.location ?? ""];
  if (!locationData) {
    console.warn(
      `[InfoBoxComponent] No location data found for location: ${hoveredLocation?.location}`,
    );
  }
  const locationDisplay = buildLocationDisplay(locationData, gameLogic);

  return (
    <div
      className={`w-full h-10 flex items-center bg-black/80 backdrop-blur-sm border-t border-stone-700`}
    >
      {locationDisplay}
    </div>
  );
}
