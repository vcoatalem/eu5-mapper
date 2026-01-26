import { JSX, use, useContext } from "react";
import { AppContext } from "../appContextProvider";
import { useGameData } from "../gameDataContext";
import { ILocationGameData } from "../lib/types";

const buildLocationDisplay = (locationData: ILocationGameData): JSX.Element => {
  if (!locationData) {
    return <span>No data available</span>;
  }
  return (
    <div className="flex flex-col">
      <span className="font-bold text-lg">{locationData.name}</span>
      <span>Topography: {locationData.topography}</span>
      {locationData.vegetation && (
        <span>Vegetation: {locationData.vegetation}</span>
      )}
      {!locationData.ownable && <span>Not Ownable</span>}
    </div>
  );
};

export function InfoBoxComponent() {
  const context = useContext(AppContext);
  const gameData = useGameData();
  if (!gameData || !gameData.locationDataMap) {
    throw new Error("gameData is not loaded");
  }

  const locationName =
    context?.hoveredLocation ?? context?.selectedLocation ?? null;

  const locationDisplay = locationName ? (
    buildLocationDisplay(gameData.locationDataMap[locationName])
  ) : (
    <span></span>
  );

  return (
    <div className="fixed bottom-5 left-5 rounded-sm min-w-64 min-h-32 flex flex-col z-10 bg-black border border-white text-md text-white p-2">
      {locationDisplay}
    </div>
  );
}
