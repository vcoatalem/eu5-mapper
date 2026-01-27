import { JSX, useContext } from "react";
import { AppContext } from "../appContextProvider";
import { ILocationGameData } from "../lib/types";
import styles from "../styles/Gui.module.css";

const buildLocationDisplay = (locationData: ILocationGameData): JSX.Element => {
  if (!locationData) {
    return <span>No data available</span>;
  }
  return (
    <>
      <div className="flex flex-col h-full">
        <span className="font-bold text-lg">{locationData.name}</span>
        <span className="text-stone-600">
          {!locationData.ownable && <span>Not Ownable</span>}
        </span>
        <span>Topography: {locationData.topography}</span>
        {locationData.vegetation && (
          <span>Vegetation: {locationData.vegetation}</span>
        )}
      </div>

      {locationData.constructibleLocationCoordinate && (
        <span>
          {locationData.constructibleLocationCoordinate.x},
          {locationData.constructibleLocationCoordinate.y}
        </span>
      )}

      <hr className="border border-stone-600 my-2 mt-auto"></hr>

      {locationData.hierarchy && (
        <div className="flex flex-col">
          <span className="text-wrap">
            Part of {locationData.hierarchy.province}
          </span>
          <span>({locationData.hierarchy.subcontinent})</span>
        </div>
      )}
    </>
  );
};

export function InfoBoxComponent() {
  const context = useContext(AppContext);
  
  if (!context || !context.gameData) {
    throw new Error("gameData is not loaded");
  }

  const locationName =
    context?.hoveredLocation ?? context?.selectedLocation ?? null;

  const locationDisplay = locationName ? (
    buildLocationDisplay(context.gameData.locationDataMap[locationName])
  ) : (
    <span></span>
  );

  return (
    <div
      className={`${styles.guiElement} fixed bottom-5 left-5 rounded-sm min-w-64 min-h-96 flex flex-col bg-black border border-white text-md text-white p-2`}
    >
      {locationDisplay}
    </div>
  );
}
