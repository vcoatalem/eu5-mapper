import { JSX, use, useContext } from "react";
import { AppContext } from "../appContextProvider";
import { useGameData } from "../gameDataContext";
import { ILocationGameData } from "../lib/types";

const buildLocationDisplay = (locationData: ILocationGameData): JSX.Element => {
  console.log("Building location display for:", locationData);
  return (
    <div className="flex flex-col">
      <span className="font-bold text-lg">{locationData.name}</span>
      <span>Topography: {locationData.topography}</span>
      {locationData.vegetation && (
        <span>Vegetation: {locationData.vegetation}</span>
      )}
    </div>
  );
};

export function InfoBoxComponent() {
  const context = useContext(AppContext);
  const gameData = useGameData();
  if (!gameData || !gameData.gameData) {
    throw new Error("gameData is not loaded");
  }

  const hexColor =
    context?.hoveredLocation?.hexColor ??
    context?.selectedLocation?.hexColor ??
    null;

  const locationDisplay = hexColor ? (
    buildLocationDisplay(gameData.gameData[hexColor])
  ) : (
    <span></span>
  );

  return (
    <div className="fixed bottom-5 left-5 rounded-sm min-w-64 min-h-32 flex flex-col z-10 bg-black border border-white text-md text-white p-2">
      {locationDisplay}
    </div>
  );
}
