import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";
import { ColorHelper } from "@/app/lib/drawing/color.helper";
import { acquireLocationSliceFromState, EditMode, editModeController } from "@/app/lib/editMode.controller";
import { gameStateController } from "@/app/lib/gameState.controller";
import { LocationsHelper } from "@/app/lib/locations.helper";
import { NumbersHelper } from "@/app/lib/utils/numbers.helper";
import { StringHelper } from "@/app/lib/utils/string.helper";
import styles from "@/app/styles/Gui.module.css";
import { memo, useContext, useMemo, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { ILocationGameData, ILocationIdentifier } from "../lib/types/general";
import { MaritimePresenceIcon } from "@/app/components/indicatorsIcons/maritimePresenceIcon.component";
import { HarborSuitabilityIcon } from "@/app/components/indicatorsIcons/harborSuitabilityIcon.component";
import { PopulationIcon } from "@/app/components/indicatorsIcons/populationIcon.component";
import { DevelopmentIcon } from "@/app/components/indicatorsIcons/developmentIcon.component";
import Image from "next/image";
import { getTopographyIcon, getVegetationIcon } from "@/app/lib/drawing/getImages";

function LocationInfoBox(
  props: {
    locationName: ILocationIdentifier,
    mode: EditMode | null,
  }
) {
  const { locationName, mode } = props;
  const gameState = useSyncExternalStore(gameStateController.subscribe.bind(gameStateController), () => gameStateController.getSnapshot());
  const { gameData } = useContext(AppContext);
  const locationData = gameData?.locationDataMap?.[locationName ?? ""];
  const temporaryData = gameState.temporaryLocationData[locationName ?? ""] ?? null;
  const owned = gameState.ownedLocations[locationData?.name ?? ""];

  const cta = useMemo<{ label: string, active: boolean }>(() => {
    if (mode === "road") {
      return { label: "Click to start building a road", active: true };
    }
    if (mode === "capital") {
      return { label: "Click to change capital location", active: true };
    }
    if (mode === "maritime") {
      if (locationData?.isSea || locationData?.isLake) {
        return { label: "Click to edit maritime presence", active: true };
      }
      return { label: "Not Maritime Location", active: false };
    }
    else {
      if (locationData?.ownable) {
        if (owned) {
          return { label: "Click to release this location", active: true };
        }
        return { label: "Click to acquire this location", active: true };
      }
      else {
        return { label: "Not Ownable", active: false };
      }
    }
  }, [mode, locationData?.ownable, owned]);

  const harborCapacity = useMemo(() => locationData ? LocationsHelper.getLocationHarborSuitability(locationData, gameState.ownedLocations[locationData?.name ?? ""]) : 0, [locationData, gameState.ownedLocations]);

  if (!locationData) {
    return <span>No data available</span>;
  }

  return (
    <div className="flex flex-row items-center gap-6 px-4 w-full">
      <div className="flex items-center gap-2 flex-1">
        <span className="font-bold text-base text-white">{StringHelper.formatLocationName(locationData.name)}</span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 min-w-12 text-sm text-stone-400"> <Image className="min-w-6" src={getTopographyIcon(locationData.topography)} alt={locationData.topography} width={24} height={24} /> {locationData.topography}</span>
        {locationData.ownable && (
          <>
            {locationData.vegetation && <span className="flex items-center gap-1 min-w-12 text-sm text-stone-400"> <Image className="min-w-6" src={getVegetationIcon(locationData.vegetation)} alt={locationData.vegetation} width={24} height={24} /> {locationData.vegetation}</span>}
            <span className="flex items-center gap-1"><DevelopmentIcon size={24} /> {locationData.development}</span>
            <span className="flex items-center gap-1"><PopulationIcon size={24} /> {NumbersHelper.formatWithSymbol(locationData.population)}</span>
            {locationData.hierarchy && (
              <div className="flex flex-col items-center gap-1 text-xs text-stone-300 ml-auto">
                <span>{locationData.hierarchy.province}</span>
                <span>{locationData.hierarchy.subcontinent}</span>
              </div>
            )}
          </>

        )}
        {locationData.isCoastal && locationData.ownable && <span className="text-white text-md flex flex-items items-center gap-1"><HarborSuitabilityIcon size={24} /> <span style={{ color: ColorHelper.rgbToHex(...ColorHelper.getHarborSuitabilityColor(harborCapacity)) }}>{harborCapacity.toFixed(2)}</span></span>}
        {(locationData.isSea || locationData.isLake) && <span className="text-white text-md flex items-center gap-1"><MaritimePresenceIcon size={24} /> <span style={{ color: ColorHelper.rgbToHex(...ColorHelper.getMaritimePresenceColor(LocationsHelper.getLocationMaritimePresence(locationData, temporaryData))) }}>{LocationsHelper.getLocationMaritimePresence(locationData, temporaryData).toFixed(2)}</span></span>}
      </div>



      <span className={["ml-auto w-64", (cta.active ? "text-yellow-500" : "text-stone-400")].join(" ")} >
        {cta.label}
      </span>

    </div>
  );
};

function HierarchyInfoBox(props: { locationNames: ILocationIdentifier[] }) {

  const gameState = useSyncExternalStore(gameStateController.subscribe.bind(gameStateController), () => gameStateController.getSnapshot());
  const gameData = useContext(AppContext)?.gameData;
  const editModeState = useSyncExternalStore(editModeController.subscribe.bind(editModeController), () => editModeController.getSnapshot());
  const editModeAcquire = useMemo(() => acquireLocationSliceFromState(editModeState), [editModeState]);
  const isAcquireMode = editModeAcquire.isModeEnabled;
  const hierarchyType = editModeAcquire.brushSize;

  const locationsLength = useMemo(() => props.locationNames.length, [props.locationNames]);
  const cta = useMemo<{ label: string, active: boolean } | null>(() => {
    if (isAcquireMode) {
      return { label: `Click to toggle ownership of ${locationsLength} locations`, active: true };
    }
    else {
      return null;
    }
  }, [locationsLength, isAcquireMode]);
  const hierarchyData = useMemo(() => gameData?.locationDataMap?.[props.locationNames[0]]?.hierarchy[hierarchyType as keyof ILocationGameData["hierarchy"]] ?? null, [gameData, props.locationNames, hierarchyType]);
  const hierarchyTotalPop = useMemo(() => props.locationNames.reduce((acc, locationName) => acc + LocationsHelper.getLocationPopulation(locationName, gameData?.locationDataMap ?? {}, gameState), 0), [props.locationNames, gameData, gameState]);
  const hierarchyAverageDevelopment = useMemo(() => props.locationNames.reduce((acc, locationName) => acc + LocationsHelper.getLocationDevelopment(locationName, gameData?.locationDataMap ?? {}, gameState), 0) / locationsLength, [props.locationNames, gameData, gameState, locationsLength]);

  if (!hierarchyData) {
    return <span>No data available</span>;
  }

  return (
    <div className="flex flex-row items-center gap-6 px-4 w-full">
      <span className="font-bold text-base text-white shrink-0">{StringHelper.formatLocationName(hierarchyData)}</span>
      <span className="text-stone-400 text-sm max-w-[50%] overflow-hidden text-ellipsis whitespace-nowrap">Locations: {props.locationNames.map((locationName) => StringHelper.formatLocationName(locationName)).join(", ")}</span>

      {(hierarchyTotalPop ?? 0) > 0 && ( // no population in the case of maritime areas
        <>
          <span className="text-sm shrink-0 flex flex-row items-center gap-1"><PopulationIcon size={24} />
          <span>{NumbersHelper.formatWithSymbol(hierarchyTotalPop)}</span>
          </span>
          <span className="text-sm shrink-0 flex flex-row items-center gap-1"><DevelopmentIcon size={24} />
          <span>{hierarchyAverageDevelopment.toFixed(2)}</span>
          <span>(average) {hierarchyAverageDevelopment.toFixed(2)}</span>
          </span>
        </>
      )}

      {cta && <span className={["ml-auto text-right shrink-0 ", (cta.active ? "text-yellow-500" : "text-stone-400")].join(" ")} >
        {cta.label}
      </span>}
    </div>
  )
}



const Container = memo(function Container(props: { children: React.ReactNode, mode: EditMode | null }) {
  const stripes = useMemo(() => {
    if (!props.mode) return "";
    if (props.mode === "road") {
      return styles.roadBuildingStripes;
    }
    if (props.mode === "capital") {
      return styles.changeCapitalStripes;
    }
    if (props.mode === "maritime") {
      return styles.editMaritimePresenceStripes;
    }
    return "";
  }, [props.mode]);
  return (
    <div className={[styles.infoBoxContainer, "h-10 bg-black/80 text-stone-400 px-4 flex items-center", stripes].join(" ")}>
      {props.children}
    </div>
  );
});

export function InfoBoxComponent() {

  const hoveredLocation = useSyncExternalStore(
    actionEventDispatcher.hoveredLocation.subscribe.bind(
      actionEventDispatcher.hoveredLocation,
    ),
    () => {
      return actionEventDispatcher.hoveredLocation.getSnapshot();
    },
  );

  const mapEditMode = useSyncExternalStore(
    editModeController.subscribe.bind(editModeController),
    () => editModeController.getSnapshot(),
  );

  const { gameData } = useContext(AppContext);
  if (!gameData) {
    return;
  }

  const hoveredLocations = hoveredLocation?.locations ?? [];
  if (hoveredLocations.length === 0) {
    return <Container mode={mapEditMode.modeEnabled ?? null}>
      Hover or select a location to view details
    </Container>;
  }

  if (hoveredLocations.length === 1) {
    return <Container mode={mapEditMode.modeEnabled ?? null}><LocationInfoBox locationName={hoveredLocations[0]} mode={mapEditMode.modeEnabled ?? null}></LocationInfoBox></Container>;
  }
  else {
    return <Container mode={mapEditMode.modeEnabled ?? null}><HierarchyInfoBox locationNames={hoveredLocations}></HierarchyInfoBox></Container>;
  }


}
