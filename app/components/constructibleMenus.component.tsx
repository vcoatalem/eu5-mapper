import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { gameStateController } from "@/app/lib/gameState.controller";
import {
  IConstructibleLocation,
  IGameData,
  IGameState,
  ILocationIdentifier,
  RoadType,
} from "../lib/types/general";
import { ConstructibleHelper } from "../lib/constructible.helper";
import { AppContext } from "../appContextProvider";
import { getGuiImage } from "../lib/drawing/namedGuiImagesMap.const";
import { proximityComputationController } from "../lib/proximityComputation.controller";
import { ColorHelper } from "../lib/drawing/color.helper";
import { ProximityComputationHelper } from "../lib/proximityComputation.helper";
import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";

const capitalPicker = (
  location: ILocationIdentifier,
  isCapital: boolean,
): React.JSX.Element => {
  return (
    <div className={"bg-white ml-1 w-4"}>
      <button
        onClick={() => {
          gameStateController.changeCapital(location);
        }}
        className={
          "px-1" +
          (isCapital
            ? " bg-black text-yellow-300"
            : " bg-white text-black hover:bg-yellow-400")
        }
      >
        ★
      </button>
    </div>
  );
};

const buildingList = (
  locationName: ILocationIdentifier,
  gameData: IGameData,
  ownedLocations: IGameState["ownedLocations"],
  constructible: IConstructibleLocation,
) => {
  const state = ConstructibleHelper.getConstructibleState(
    locationName,
    constructible,
    gameData,
    ownedLocations,
  );
  return (
    <div className="flex flex-row space-x-2 ml-2">
      {state.buildings
        .filter((building) => building.canBuild || building.reason === "limit")
        .map((building) => (
          <div key={building.name} className="inline-block">
            <button
              className={
                "relative flex items-center justify-center " +
                (building.canBuild
                  ? "hover:bg-yellow-400 "
                  : "backdrop-grayscale-50 ") +
                (building.amountBuilt > 0 ? "bg-yellow-300 " : "") +
                (building.amountBuilt > 0 && !building.canBuild
                  ? " hover:bg-red-500 "
                  : "")
              }
              onClick={() => {
                if (!building.canBuild && building.amountBuilt > 0) {
                  gameStateController.removeBuildingFromLocation(
                    locationName,
                    building.name,
                  );
                } else {
                  gameStateController.addBuildingToLocation(
                    locationName,
                    building.name,
                  );
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                gameStateController.removeBuildingFromLocation(
                  locationName,
                  building.name,
                );
              }}
              style={{ width: 32, height: 32, padding: 0 }}
            >
              <img
                src={getGuiImage(building.name)}
                alt={building.name}
                width={24}
                height={24}
                style={{ display: "block" }}
              />
              {building.amountBuilt > 0 && (
                <span
                  className="absolute left-0 bottom-0 mb-0.5 ml-0.5 px-1 py-0 text-xs font-bold text-black bg-white/70 backdrop-blur-sm rounded z-10"
                  style={{
                    pointerEvents: "none",
                    fontSize: "0.75rem",
                    minWidth: 16,
                    minHeight: 16,
                    lineHeight: "16px",
                    textAlign: "center",
                  }}
                >
                  {building.amountBuilt}
                </span>
              )}
            </button>
          </div>
        ))}
    </div>
  );
};

const locationRankPicker = (
  locationName: ILocationIdentifier,
  constructible: IConstructibleLocation,
) => {
  return (
    <div className="ml-2 flex flex-row space-x-1">
      {(["rural", "town", "city"] as IConstructibleLocation["rank"][]).map(
        (rank) => (
          <button
            key={rank}
            disabled={constructible.rank === rank}
            className={
              constructible.rank === rank
                ? `disabled:backdrop-grayscale-75 bg-yellow-300`
                : `bg-black hover:bg-yellow-400`
            }
            onClick={() =>
              gameStateController.changeLocationRank(locationName, rank)
            }
          >
            <img
              className="p-1"
              src={getGuiImage(rank)}
              alt={rank}
              width={24}
              height={24}
            ></img>
          </button>
        ),
      )}
    </div>
  );
};

const ConstructibleLocationItem = React.memo(
  function constructibleLocationItem({
    location,
    constructible,
    gameData,
    gameState,
    proximityComputation,
  }: {
    location: ILocationIdentifier;
    constructible: IConstructibleLocation;
    gameData: IGameData;
    gameState: IGameState;
    proximityComputation: ReturnType<
      typeof proximityComputationController.getSnapshot
    >;
  }) {
    const locationNameDivRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = locationNameDivRef.current;
      if (el) {
        console.log("[ConstructibleLocationItem] registering action sources");
        actionEventDispatcher.registerHoverActionSource(el, () => location);
        actionEventDispatcher.registerClickActionSource(
          el,
          () => location,
          "goto",
        );
      }
      return () => {
        if (el) {
          console.log(
            "[ConstructibleLocationItem] unregistering action sources",
          );
          actionEventDispatcher.clearEventListenersForElement(el);
        }
      };
    }, [location]);

    return (
      <div
        key={location}
        className="py-1 h-10 grid grid-cols-9 items-center whitespace-nowrap gap-2 w-[600px]"
      >
        <div
          className="font-bold col-span-2 truncate ... flex-none cursor-pointer"
          ref={locationNameDivRef}
        >
          <span className="text-lg ">{location}</span>
        </div>
        <span
          className="col-span-1"
          style={{
            color: ColorHelper.rgbToHex(
              ...ColorHelper.getEvaluationColor(
                proximityComputation.result[location]?.cost ?? 100,
              ),
            ),
          }}
        >
          {ProximityComputationHelper.evaluationToProximity(
            proximityComputation.result[location]?.cost,
          ) ?? 0}
        </span>
        <div className="col-span-2 flex flex-row items-center space-x-2">
          {capitalPicker(location, gameState.capitalLocation === location)}
          {locationRankPicker(location, constructible)}
        </div>
        <div className="col-span-1">
          {buildingList(
            location,
            gameData,
            gameState.ownedLocations,
            constructible,
          )}
        </div>
      </div>
    );
  },
);

const RoadItem = React.memo(function roadItem({ roadKey, type }: { roadKey: `${string}-${string}`; type: RoadType }) {
  const [from, to] = roadKey.split('-');
  if (!from || !to) {
    return <></>;
  }
  return (
    <div key={roadKey} className="flex flex-row items-center gap-2">
      <span>{from} - {to}</span>
      <div className="flex flex-row items-center-gap-2">
        {
          (["gravel_road", "paved_road", "modern_road", "rail_road"] satisfies RoadType[]).map((possibleRoadType) => (
            <button key={possibleRoadType}
            onClick={() => {
              gameStateController.changeRoadType(roadKey, possibleRoadType);
            }}
            className={`${type === possibleRoadType ? "bg-yellow-300" : "bg-black hover:bg-yellow-400"}`}
            >
              <img src={getGuiImage(possibleRoadType)} alt={possibleRoadType} width={24} height={24} />
            </button>
          ))
        }
        
      </div>
    </div>
  );
});

interface FoldableMenuProps {
  title: string | React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FoldableMenu({ title, isExpanded, onToggle, children }: FoldableMenuProps) {
  return (
    <>
      <div className="flex-shrink-0">
        <span 
          onClick={onToggle} 
          className="font-bold hover:bg-stone-600 rounded-md py-1 cursor-pointer flex items-center gap-2 truncate ... ellipsis"
        >
          <span 
            className={`inline-block transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
          {title}
        </span>
      </div>
      <div 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded 
            ? 'max-h-[1000px] opacity-100 overflow-y-auto overflow-x-hidden' 
            : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        {children}
      </div>
    </>
  );
}

export function ConstructibleMenusComponent() {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );
  const proximityComputation = useSyncExternalStore(
    proximityComputationController.subscribe.bind(
      proximityComputationController,
    ),
    () => proximityComputationController.getSnapshot(),
  );
  const { gameData } = useContext(AppContext);

  const [search, setSearch] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [ownedLocationsExpanded, setOwnedLocationsExpanded] = useState<boolean>(false);
  const [roadsExpanded, setRoadsExpanded] = useState<boolean>(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const borderThreshold = 20; // pixels from edge to trigger expansion/collapse

  const filteredLocationEntries = useMemo(() => {
    const entries = Object.entries(gameState.ownedLocations);
    if (!search) {
      return entries;
    }
    const searchLower = search.toLowerCase();
    return entries.filter(([locationName]) =>
      locationName.toLowerCase().includes(searchLower)
    );
  }, [search, gameState.ownedLocations]);

  const filteredRoadsEntries = useMemo(() => {
    const entries = ConstructibleHelper.getOwnedRoads(gameState.ownedLocations, gameState.roads);
    if (!search) {
      return entries;
    }
    const searchLower = search.toLowerCase();

    for (const [key,] of Object.entries(entries)) {
      if (!(key.toLowerCase().includes(searchLower))) {
        delete entries[key as keyof typeof entries];
      }
    }
    return entries;
  }, [search, gameState.ownedLocations, gameState.roads])

  // Auto-expand when search has results
  // This is a legitimate side effect: syncing UI state (expansion) with user input (search)
  useEffect(() => {
    if (search && filteredLocationEntries.length > 0) {
      setOwnedLocationsExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLocationEntries.length]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX;
    const leftEdge = rect.left;
    const rightEdge = rect.right;
    const distanceFromLeft = mouseX - leftEdge;
    const distanceFromRight = rightEdge - mouseX;
    
    if (!isExpanded) {
      // Not expanded: expand when mouse is near right border
      if (distanceFromRight >= 0 && distanceFromRight <= borderThreshold) {
        setIsExpanded(true);
      }
    } else {
      // Expanded: collapse when mouse is near left border
      if (distanceFromLeft >= 0 && distanceFromLeft <= borderThreshold) {
        setIsExpanded(false);
      }
    }
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
  };

  if (!gameData) {
    throw new Error(
      "[ConstructibleMenusComponent]: need gameData in context to render",
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-96 ${isExpanded ? 'w-[600px]' : 'w-52'} overflow-x-hidden max-h-[50vh] transition-[width] duration-300 ease-in-out flex flex-col`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex-shrink-0">
        <input
          type="search"
          placeholder="Search for a location..."
          className="w-full"
          onChange={(e) => setSearch(e.target.value)}
          style={{ outline: "none" }}
        />
        <hr className="w-full"></hr>
      </div>
      <FoldableMenu
        title={`Owned Locations (${Object.keys(gameState.ownedLocations).length})`}
        isExpanded={ownedLocationsExpanded}
        onToggle={() => setOwnedLocationsExpanded(!ownedLocationsExpanded)}
      >
        {filteredLocationEntries
          .sort(
            ([a], [b]) =>
              (proximityComputation.result[a]?.cost ?? 100) -
              (proximityComputation.result[b]?.cost ?? 100),
          )
          .map(([locationName, constructibleData]) => (
            <ConstructibleLocationItem
              key={locationName}
              location={locationName}
              constructible={constructibleData}
              gameData={gameData}
              gameState={gameState}
              proximityComputation={proximityComputation}
            />
          ))}
      </FoldableMenu>
      <FoldableMenu
        title={`Owned Roads (${Object.keys(filteredRoadsEntries).length})`}
        isExpanded={roadsExpanded}
        onToggle={() => setRoadsExpanded(!roadsExpanded)}
      >
        {filteredRoadsEntries && Object.entries(filteredRoadsEntries).map(([key, type]) => (
          <RoadItem key={key} roadKey={key as `${string}-${string}`} type={type} />
        ))}
      </FoldableMenu>
    </div>
  );
}
