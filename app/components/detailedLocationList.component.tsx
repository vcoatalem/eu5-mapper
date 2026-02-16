import { ILocationDetailedViewData } from "@/app/components/detailedLocationViewModal.component";
import { ILocationIdentifier, LocationRank } from "@/app/lib/types/general";
import Image from "next/image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "@/app/styles/button.module.css";
import { FormattedProximityWithPathfindingTooltip } from "@/app/components/formattedProximityWithPathfindingTooltip.component";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ColorHelper } from "@/app/lib/drawing/color.helper";
import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { EditableField } from "@/app/components/editableField.component";
import { NumbersHelper } from "@/app/lib/utils/numbers.helper";
import { getGuiImage } from "@/app/lib/drawing/namedGuiImagesMap.const";
import { ConstructibleAction } from "@/app/lib/types/building";
import { MdOutlineRemoveCircleOutline, MdOutlineAddCircleOutline } from "react-icons/md";
import {FaAnglesDown, FaAnglesUp} from 'react-icons/fa6';

interface IDetailedLocationListProps {
  ownedLocations: Record<ILocationIdentifier, ILocationDetailedViewData>;
  capitalLocation: ILocationIdentifier | null;
  togglePin?: (location: ILocationIdentifier) => void;
}

function DisplayLocation(props: {
  data: ILocationDetailedViewData;
  extensiveViewProps?: IDetailedLocationListProps;
}) {
  const isCapital = useMemo(
    () =>
      props.extensiveViewProps?.capitalLocation ===
      props.data.baseLocationGameData.name,
    [
      props.extensiveViewProps?.capitalLocation,
      props.data.baseLocationGameData.name,
    ],
  );
  const isPinned = props.data.pinned ?? false;
  const capitalBtn = (
    <ButtonWithTooltip
      key={"capital-btn-" + props.data.baseLocationGameData.name}
      isActive={isCapital}
      tooltip={
        isCapital ? (
          <span>This is your capital</span>
        ) : (
          <span>Change capital</span>
        )
      }
      onClick={() =>
        !isCapital
          ? gameStateController.changeCapital(
            props.data.baseLocationGameData.name,
          )
          : null
      }
      showOnHover={true}
      className="ml-auto"
    >
      <Image
        src={"/icons/star.svg"}
        alt="capital location"
        width={16}
        height={16}
      />
    </ButtonWithTooltip>
  );
  const pinBtn = (
    <ButtonWithTooltip
      key={"pin-btn-" + props.data.baseLocationGameData.name}
      isActive={isPinned}
      tooltip={
        isPinned ? <span>Unpin location</span> : <span>Pin location</span>
      }
      showOnHover={true}
      className="ml-auto"
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
      <Image src={"/icons/pin.svg"} alt="pin location" width={16} height={16} />
    </ButtonWithTooltip>
  );
  const buttons = [capitalBtn, pinBtn];
  const activeButtons = buttons.filter((btn, idx) =>
    idx === 0 ? isCapital : isPinned,
  );
  const inactiveButtons = buttons.filter(
    (btn, idx) => !(idx === 0 ? isCapital : isPinned),
  );
  return (
    <div className="group w-full h-full flex flex-row items-center px-1 relative">
      <span className="px-1 py-1 flex-none">
        {StringHelper.formatLocationName(props.data.baseLocationGameData.name)}
      </span>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-row-reverse gap-1">
        {activeButtons}
        {inactiveButtons}
      </div>
    </div>
  );
}

function DisplayProximity(props: { data: ILocationDetailedViewData }) {
  return (
    <FormattedProximityWithPathfindingTooltip
      className=""
      location={props.data.baseLocationGameData.name}
      proximity={props.data.proximity ?? 0}
    ></FormattedProximityWithPathfindingTooltip>
  );
}

function DisplayDevelopment(props: { data: ILocationDetailedViewData }) {
  const { dev, isModified, isHigher } = useMemo(() => {
    const baseDev = props.data.baseLocationGameData.development ?? 0;
    const tempDev = props.data.temporaryLocationData.development;
    const isModified = tempDev !== undefined && tempDev !== baseDev;
    const isHigher = tempDev !== undefined && tempDev > baseDev;
    return {
      isHigher,
      dev: tempDev ?? baseDev,
      isModified,
    };
  }, [
    props.data.baseLocationGameData.development,
    props.data.temporaryLocationData.development,
  ]);
  return (
    <div className="px-2 py-1 group w-full h-full flex flex-row items-center relative">
      <EditableField<number>
        value={dev}
        baseValue={props.data.baseLocationGameData.development}
        onValidate={(value) => {
          if (-100 < value && value < 100) {
            gameStateController.changeTemporaryLocationData(
              props.data.baseLocationGameData.name,
              { development: value },
            );
          }
        }}
        tooltip={<span>Edit development</span>}
      >
        <span
          style={{
            color: isModified
              ? ColorHelper.rgbToHex(
                ...ColorHelper.getEvaluationColor(isHigher ? 30 : 70),
              )
              : "white",
          }}
        >
          {dev}
        </span>
      </EditableField>
    </div>
  );
}

function DisplayPop(props: { data: ILocationDetailedViewData }) {
  const { pop, basePop } = {
    pop:
      props.data.temporaryLocationData.population ??
      props.data.baseLocationGameData.population ??
      0,
    basePop: props.data.baseLocationGameData.population ?? 0,
  };
  const isModified = basePop !== pop;
  const baseIsLower = basePop < pop;
  return (
    <div className="px-2 py-1 group w-full h-full flex flex-row items-center relative">
      <EditableField<number>
        value={pop}
        baseValue={basePop}
        onValidate={(value) => {
          if (value > 0) {
            gameStateController.changeTemporaryLocationData(
              props.data.baseLocationGameData.name,
              { population: value },
            );
          }
        }}
        tooltip={
          <div className="flex flex-col items-start">
            <p>
              Population in that location:{" "}
              <span className="font-bold">{pop}</span>
            </p>
            <p>Click to edit</p>
          </div>
        }
      >
        <span
          style={{
            color: isModified
              ? ColorHelper.rgbToHex(
                ...ColorHelper.getEvaluationColor(baseIsLower ? 70 : 30),
              )
              : "white",
          }}
        >
          {NumbersHelper.formatWithSymbol(pop)}
        </span>
      </EditableField>
    </div>
  );
}

function DisplayBuildings(props: { data: ILocationDetailedViewData }) {
/*    console.log(
    `[DetailedLocationList] constructibleState for location ${props.data.baseLocationGameData.name}`,
    props.data.constructibleState,
  ); */

  const actionsMetadata: Record<ConstructibleAction["type"], {
    icon: React.ReactNode;
    tooltip: string;
  }> = {
    upgrade: {
      icon: <FaAnglesUp size={16}></FaAnglesUp>,
      tooltip: "Upgrade building",
    },
    downgrade: {
      icon: <FaAnglesDown size={16}></FaAnglesDown>,
      tooltip: "Downgrade building",
    },
    demolish: {
      icon: <MdOutlineRemoveCircleOutline size={16}></MdOutlineRemoveCircleOutline>,
      tooltip: "Demolish building",
    },
    build: {
      icon: <MdOutlineAddCircleOutline size={16}></MdOutlineAddCircleOutline>,
      tooltip: "Build building",
    },
  };

  return <div className="flex flex-row w-full h-full">{
    Object.entries(props.data.constructibleState).map(([buildingTemplateName, { instance, possibleActions }]) => {
      const key = `${props.data.baseLocationGameData.name}-${buildingTemplateName}`;
      return (<div key={key} className="flex flex-row items-center gap-1">
        <Image src={getGuiImage(buildingTemplateName) ?? "/icons/question.svg"} alt={buildingTemplateName} width={16} height={16} />
        {
          possibleActions.map((action) => {
            const actionKey = `${key}-${action.type}`;
            return (
              <button key={actionKey} className={`flex flex-row items-center gap-1 ${styles.iconButton}` } onClick={() => gameStateController.handleBuildingAction(props.data.baseLocationGameData.name, action)}>
                {actionsMetadata[action.type].icon}
              </button>
            )
          })
        }
      </div>)
    })}
  </div>;
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
const minimalColumnWidth = 128;

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
        gridTemplateColumns: `repeat(${totalColumns}, minmax(${minimalColumnWidth}px, 1fr))`,
      }}
      className={
        "grid border-b font-bold " +
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
              `group border h-12 pl-2 pb-1 pt-2 flex flex-row items-center ` +
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
      className={`grid overflow-w-scroll min-w-[1200px] overflow-y-scroll overflow-x-scroll overscroll-x-none`}
      style={{ scrollbarGutter: "stable" }}
    >
      {/* Header Line */}
      <div
        className="grid sticky top-0 z-2"
        style={{
          gridTemplateColumns: `repeat(${totalColumns}, minmax(128px, 1fr))`,
        }}
      >
        {columns.map((col) => (
          <button
            key={col.title}
            style={{ gridColumn: `span ${col.cols}` }}
            className={`flex flex-row items-center gap-1  ${sort?.column === col.title ? "bg-blue-500" : "bg-black hover:bg-blue-500/50 backdrop-blur-3xl"}  border font-bold px-2 py-1`}
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
                width={16}
                height={16}
              />
            )}
          </button>
        ))}
      </div>
      {/* Sticky Lines (pinned content) */}
      {/* top offset not to be proper to avoid going under the header */}
      <div className="sticky top-8 bg-black z-1">
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
