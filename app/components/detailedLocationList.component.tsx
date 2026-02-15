import { ILocationDetailedViewData } from "@/app/components/detailedLocationViewModal.component";
import { ILocationIdentifier, LocationRank } from "@/app/lib/types/general";
import Image from "next/image";
import React, { useCallback, useMemo, useRef, useState } from "react";
import styles from "@/app/styles/button.module.css";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { FormattedProximityWithPathfindingTooltip } from "@/app/components/formattedProximityWithPathfindingTooltip.component";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { gameStateController } from "@/app/lib/gameState.controller";

interface IDetailedLocationListProps {
  ownedLocations: Record<ILocationIdentifier, ILocationDetailedViewData>;
  capitalLocation: ILocationIdentifier | null;
  togglePin?: (location: ILocationIdentifier) => void;
}

function DisplayLocation(props: {
  data: ILocationDetailedViewData;
  extensiveViewProps?: IDetailedLocationListProps;
}) {
  const pinButtonDivRef = useRef<HTMLDivElement>(null);
  const capitalButtonDivRef = useRef<HTMLDivElement>(null);
  const isCapital = useMemo(
    () =>
      props.extensiveViewProps?.capitalLocation ===
      props.data.baseLocationGameData.name,
    [
      props.extensiveViewProps?.capitalLocation,
      props.data.baseLocationGameData.name,
    ],
  );
  return (
    <div className="w-full h-full flex flex-row items-center px-1">
      <span className="px-1 py-1">
        {StringHelper.formatLocationName(props.data.baseLocationGameData.name)}
      </span>

      <div className="w-full h-full relative">
        <div className="absolute right-0">
          <div className="flex flex-row-reverse gap-1 ">
            {/* Capital button - visible on hover or if the location is capital */}
            <div
              ref={capitalButtonDivRef}
              className={
                " ml-auto group-hover:block  " +
                (isCapital ? " block " : " hidden ")
              }
            >
              <Tooltip>
                <TooltipTrigger>
                  <button
                    className={`${styles.iconButton} ${isCapital ? styles.buttonActive : ""}`}
                    onClick={() =>
                      !isCapital
                        ? gameStateController.changeCapital(
                            props.data.baseLocationGameData.name,
                          )
                        : null
                    }
                  >
                    <Image
                      src={"/icons/star.svg"}
                      alt="capital location"
                      width={24}
                      height={24}
                    ></Image>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  anchor={{
                    type: "dom",
                    ref: capitalButtonDivRef as React.RefObject<HTMLElement>,
                  }}
                >
                  {isCapital ? (
                    <span>This is your capital</span>
                  ) : (
                    <span>Change capital</span>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Pin button - visible on hover or if the location is pinned */}
            <div
              className={
                " ml-auto group-hover:block " +
                (props.data.pinned ? " block " : " hidden ")
              }
              ref={pinButtonDivRef}
            >
              <Tooltip>
                <TooltipTrigger>
                  <button
                    className={`${styles.iconButton} ${props.data.pinned ? styles.buttonActive : ""}`}
                    onClick={() => {
                      if (!props.extensiveViewProps) {
                        return;
                      }
                      const { togglePin } = props.extensiveViewProps;
                      if (!togglePin) {
                        return;
                      }
                      return togglePin(props.data.baseLocationGameData.name);
                    }}
                  >
                    <Image
                      src={"/icons/pin.svg"}
                      alt="pin location"
                      width={24}
                      height={24}
                    ></Image>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  anchor={{
                    type: "dom",
                    ref: pinButtonDivRef as React.RefObject<HTMLElement>,
                  }}
                >
                  <span>
                    {props.data.pinned ? "Unpin location" : "Pin location"}
                  </span>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DisplayProximity(props: { data: ILocationDetailedViewData }) {
  return (
    <FormattedProximityWithPathfindingTooltip
      className="px-2 py-1"
      location={props.data.baseLocationGameData.name}
      proximity={props.data.proximity ?? 0}
    ></FormattedProximityWithPathfindingTooltip>
  );
}

function DisplayDevelopment(props: { data: ILocationDetailedViewData }) {
  return (
    <div className="px-2 py-1">
      {props.data.temporaryLocationData.development ??
        props.data.baseLocationGameData.development}
    </div>
  );
}

function DisplayPop(props: { data: ILocationDetailedViewData }) {
  return (
    <div className="px-2 py-1">
      {props.data.temporaryLocationData.population ??
        props.data.baseLocationGameData.population}
    </div>
  );
}

function DisplayBuildings(props: { data: ILocationDetailedViewData }) {
  return <div>buildings go here</div>;
}

function DisplayRank(props: { data: ILocationDetailedViewData }) {
  return (
    <select
      id={props.data.baseLocationGameData.name + "-rank"}
      className={"w-full h-full outline-none " + styles.simpleButton}
      onChange={({ target }) => {
        console.log("changing location rank to " + target.value);
        gameStateController.changeLocationRank(
          props.data.baseLocationGameData.name,
          target.value as LocationRank,
        );
      }}
      value={props.data.constructibleData.rank}
    >
      {["rural", "town", "city"].map((rank) => (
        <option style={{ outline: "none" }} key={rank} value={rank}>
          {rank}
        </option>
      ))}
    </select>
  );
}

const columns: Array<{
  title: string;
  cols: number;
  displayComponent: React.FC<{
    data: ILocationDetailedViewData;
    extensiveViewProps?: IDetailedLocationListProps;
  }>;
  sortBy: (
    a: ILocationDetailedViewData,
    b: ILocationDetailedViewData,
  ) => number;
}> = [
  {
    title: "Location",
    cols: 2,
    displayComponent: DisplayLocation,
    sortBy: (a, b) =>
      a.baseLocationGameData.name.localeCompare(b.baseLocationGameData.name),
  },
  {
    title: "Proximity",
    cols: 1,
    displayComponent: DisplayProximity,
    sortBy: (a, b) => {
      const proxA = a.proximity ?? 0;
      const proxB = b.proximity ?? 0;
      return proxB - proxA;
    },
  },
  {
    title: "Development",
    cols: 1,
    displayComponent: DisplayDevelopment,
    sortBy: (a, b) => {
      const devA =
        a.temporaryLocationData.development ??
        a.baseLocationGameData.development ??
        0;
      const devB =
        b.temporaryLocationData.development ??
        b.baseLocationGameData.development ??
        0;
      return devB - devA;
    },
  },
  {
    title: "Population",
    cols: 1,
    displayComponent: DisplayPop,
    sortBy: (a, b) => {
      const popA =
        a.temporaryLocationData.population ??
        a.baseLocationGameData.population ??
        0;
      const popB =
        b.temporaryLocationData.population ??
        b.baseLocationGameData.population ??
        0;
      return popB - popA;
    },
  },
  {
    title: "Rank",
    cols: 1,
    displayComponent: DisplayRank,
    sortBy: (a, b) => {
      const rankings: Record<LocationRank, number> = {
        rural: 0,
        town: 1,
        city: 2,
      };
      const rankA = rankings[a.baseLocationGameData.rank] ?? -1;
      const rankB = rankings[b.baseLocationGameData.rank] ?? -1;
      return rankB - rankA;
    },
  },
  {
    title: "Buildings",
    cols: 6,
    displayComponent: DisplayBuildings,
    sortBy: (a, b) => 0, // no sorting for now
  },
];
const totalColumns = columns.reduce((sum, col) => sum + col.cols, 0);

type SortOrder = "asc" | "desc" | null;

function LocationLine(props: {
  location: ILocationIdentifier;
  sort: { order: SortOrder; column: string } | null;
  data: ILocationDetailedViewData;
  extensiveViewProps: IDetailedLocationListProps;
}) {
  const { location, sort, data, extensiveViewProps } = props;
  return (
    <div
      key={location}
      style={{
        gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
      }}
      className={
        "grid border font-bold " +
        (data.pinned
          ? "bg-blue-300/50 hover:bg-blue-300/60 sticky  "
          : " hover:bg-stone-700 ")
      }
    >
      {columns.map((col) => {
        return (
          <div
            key={col.title}
            style={{ gridColumn: `span ${col.cols}` }}
            className={
              `group border h-12 pt-2 pb-1` +
              (sort?.column === col.title ? " bg-blue-300/30 " : "")
            }
          >
            {
              <col.displayComponent
                data={data}
                extensiveViewProps={extensiveViewProps}
              ></col.displayComponent>
            }
          </div>
        );
      })}
    </div>
  );
}

export function DetailedLocationList(props: IDetailedLocationListProps) {
  const [sort, setSort] = useState<{ order: SortOrder; column: string } | null>(
    null,
  );

  const {
    sortedItems,
    pinnedItems,
  }: {
    sortedItems: IDetailedLocationListProps["ownedLocations"];
    pinnedItems: IDetailedLocationListProps["ownedLocations"];
  } = useMemo(() => {
    const sortByFn =
      columns.find((col) => col.title === sort?.column)?.sortBy ??
      columns[0].sortBy;

    const sorted = Object.entries(props.ownedLocations).sort(([, a], [, b]) => {
      if (!sortByFn) return 0;
      const order = sort?.order ?? "asc";
      const result = sortByFn(a, b);
      return order === "asc" ? result : -result;
    });

    const res = {
      sortedItems: Object.fromEntries(
        sorted.filter(([, data]) => data.pinned === false),
      ),
      pinnedItems: Object.fromEntries(
        sorted.filter(([, data]) => data.pinned === true),
      ),
    };

    /* console.log({ sortedItems: res.sortedItems, pinnedItems: res.pinnedItems }); */
    return res;
  }, [props.ownedLocations, sort]);

  const toggleSort = useCallback((column: string) => {
    setSort((currentSort) => {
      if (!currentSort || currentSort.column !== column) {
        return { column, order: "asc" };
      }
      if (currentSort.order === "asc") {
        return { column, order: "desc" };
      }
      return null;
    });
  }, []);

  return (
    <div
      className={`grid overflow-w-scroll min-w-[1200px] overflow-y-scroll`}
      style={{ scrollbarGutter: "stable" }}
    >
      {/* Header Line */}
      <div
        className="grid sticky top-0 z-1"
        style={{
          gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
        }}
      >
        {columns.map((col) => (
          <button
            key={col.title}
            style={{ gridColumn: `span ${col.cols}` }}
            className={`flex flex-row items-center gap-1 ${sort?.column === col.title ? "bg-blue-500" : "bg-black hover:bg-blue-500/50 backdrop-blur-3xl"}  border font-bold px-2 py-1`}
            onClick={() => toggleSort(col.title)}
          >
            <span>{col.title}</span>
            {sort?.column === col.title && (
              <Image
                src={
                  sort?.order === "asc"
                    ? "/icons/chevron-up.svg"
                    : "/icons/chevron-down.svg"
                }
                alt="Sort Icon"
                width={24}
                height={24}
              />
            )}
          </button>
        ))}
      </div>
      {/* Sticky Lines (pinned content) */}
      <div className="sticky top-6 backdrop-blur-3xl">
        {Object.entries(pinnedItems).map(([locId, locData]) => {
          return (
            <LocationLine
              key={locId}
              location={locId}
              sort={sort}
              data={locData}
              extensiveViewProps={props}
            ></LocationLine>
          );
        })}
      </div>

      {/* Sorted Lines (content) */}
      {sortedItems &&
        Object.entries(sortedItems).map(([locId, locData]) => {
          return (
            <LocationLine
              key={locId}
              location={locId}
              sort={sort}
              data={locData}
              extensiveViewProps={props}
            ></LocationLine>
          );
        })}
    </div>
  );
}
