import { JSX, memo, useContext, useMemo, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { IGameState, ILocationGameData, ITemporaryLocationData } from "../lib/types/general";
import { gameStateController } from "@/app/lib/gameState.controller";
import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";
import { LocationsHelper } from "@/app/lib/locations.helper";
import { roadBuilderController } from "@/app/lib/roadBuilderController";
import styles from "@/app/styles/Gui.module.css";
import { changeCapitalController } from "@/app/lib/changeCapital.controller";
import { NumbersHelper } from "@/app/lib/utils/numbers.helper";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { maritimePresenceEditController } from "@/app/lib/maritimePresenceEditController";
import { ColorHelper } from "@/app/lib/drawing/color.helper";

function LocationInfoBox(
  props: {
    locationData: ILocationGameData,
    temporaryData: ITemporaryLocationData,
    gameState: IGameState,
    mode: "acquire" | "roadBuilding" | "changeCapital" | "editMaritimePresence",
  }
) {
  const { locationData, gameState, mode, temporaryData } = props;

  const owned = useMemo(() => gameState.ownedLocations[locationData?.name ?? ""], [gameState.ownedLocations, locationData?.name]);

  const cta = useMemo<{ label: string, active: boolean }>(() => {
    if (mode === "roadBuilding") {
      return { label: "Click to start building a road", active: true };
    }
    if (mode === "changeCapital") {
      return { label: "Click to change capital location", active: true };
    }
    if (mode === "editMaritimePresence") {
      if (locationData.isSea || locationData.isLake) {
        return { label: "Click to edit maritime presence", active: true };
      }
      return { label: "Not Maritime Location", active: false };
    }
    else {
      if (props.locationData.ownable) {
        if (owned) {
          return { label: "Click to release this location", active: true };
        }
        return { label: "Click to acquire this location", active: true };
      }
      else {
        return { label: "Not Ownable", active: false };
      }
    }
  }, [mode, locationData.ownable, owned]);

  const harborCapacity = useMemo(() => LocationsHelper.getLocationHarborSuitability(locationData, gameState.ownedLocations[locationData.name]), [locationData, gameState.ownedLocations]);


  if (!locationData || !gameState.ownedLocations) {
    // can happen with HMR
    return <></>
  }

  if (!locationData) {
    return <span>No data available</span>;
  }
  return (
    <div className="flex flex-row items-center gap-6 px-4 w-full">
      <div className="flex items-center gap-2 flex-1">
        <span className="font-bold text-base text-white">{StringHelper.formatLocationName(locationData.name)}</span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span>🏔️ {locationData.topography}</span>
        {locationData.ownable && (
          <>
            {locationData.vegetation && <span>🌿 {locationData.vegetation}</span>}
            <span>📈 {locationData.development}</span>
            <span>👥 {NumbersHelper.formatWithSymbol(locationData.population)}</span>
            {locationData.hierarchy && (
              <div className="flex flex-col items-center gap-1 text-xs text-stone-300 ml-auto">
                <span>{locationData.hierarchy.province}</span>
                <span>{locationData.hierarchy.subcontinent}</span>
              </div>
            )}
          </>

        )}
        {locationData.isCoastal && locationData.ownable && <span className="text-white text-md">⚓ Harbor Suitability: <span style={{ color: ColorHelper.rgbToHex(...ColorHelper.getHarborSuitabilityColor(harborCapacity)) }}>{harborCapacity.toFixed(2)}</span></span>}
        {(locationData.isSea || locationData.isLake) && <span className="text-white text-md">⚓ Maritime Presence: <span style={{ color: ColorHelper.rgbToHex(...ColorHelper.getMaritimePresenceColor(LocationsHelper.getLocationMaritimePresence(locationData, temporaryData))) }}>{LocationsHelper.getLocationMaritimePresence(locationData, temporaryData).toFixed(2)}</span></span>}
      </div>



      <span className={["ml-auto w-64", (cta.active ? "text-yellow-500" : "text-stone-400")].join(" ")} >
        {cta.label}
      </span>

    </div>
  );
};



const Container = memo(function Container(props: { children: React.ReactNode, mode: "acquire" | "roadBuilding" | "changeCapital" | "editMaritimePresence" }) {
  const stripes = useMemo(() => {
    if (props.mode === "roadBuilding") {
      return styles.roadBuildingStripes;
    }
    if (props.mode === "changeCapital") {
      return styles.changeCapitalStripes;
    }
    if (props.mode === "editMaritimePresence") {
      return styles.editMaritimePresenceStripes;
    }
    return "";
  }, [props.mode]);
  return (
    <div className={[styles.infoBoxContainer, "h-12 bg-black/80 text-stone-400 px-4 flex items-center", stripes].join(" ")}>
      {props.children}
    </div>
  );
});

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

  const roadBuildingMode = useSyncExternalStore(
    roadBuilderController.subscribe.bind(roadBuilderController),
    () => roadBuilderController.getSnapshot(),
  );

  const changeCapitalMode = useSyncExternalStore(
    changeCapitalController.subscribe.bind(changeCapitalController),
    () => changeCapitalController.getSnapshot(),
  );

  const maritimePresenceEditMode = useSyncExternalStore(
    maritimePresenceEditController.subscribe.bind(maritimePresenceEditController),
    () => maritimePresenceEditController.getSnapshot(),
  );

  const mode = useMemo(() => {
    if (roadBuildingMode.isModeEnabled) {
      return "roadBuilding";
    }
    if (changeCapitalMode.isModeEnabled) {
      return "changeCapital";
    }
    if (maritimePresenceEditMode.isModeEnabled) {
      return "editMaritimePresence";
    }
    return "acquire";
  }, [roadBuildingMode.isModeEnabled, changeCapitalMode.isModeEnabled, maritimePresenceEditMode.isModeEnabled]);

  const { gameData } = useContext(AppContext);
  if (!gameData) {
    return;
  }

  const hoveredLocations = hoveredLocation?.locations ?? [];
  if (hoveredLocations.length === 0) {
    return <Container mode={mode}>
      Hover or select a location to view details
    </Container>;
  }

  const primaryLocation = hoveredLocations[0];
  const locationData =
    gameData.locationDataMap?.[primaryLocation ?? ""];
  const temporaryData = gameLogic.temporaryLocationData[primaryLocation ?? ""] ?? null;
  if (!locationData) {
    console.warn(
      `[InfoBoxComponent] No location data found for location: ${primaryLocation}`,
    );
    return <Container mode={mode}>
      Hover or select a location to view details
    </Container>;
  }

  return <Container mode={mode}><LocationInfoBox locationData={locationData} temporaryData={temporaryData} gameState={gameLogic} mode={mode}></LocationInfoBox></Container>;
}
