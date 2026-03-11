import {
  columns,
  IDetailedLocationListProps,
  SortOrder,
} from "@/app/components/detailedList/detailedList.config";
import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { LocationIdentifier } from "@/app/lib/types/general";
import listStyles from "@/app/styles/detailedLocationList.module.css";
import { useMemo, useState, useEffect } from "react";
import { FaAnglesDown, FaAnglesUp } from "react-icons/fa6";

const minimalColumnWidth = 128; // px
const lineHeight = 48; // px
const minListHeightPx = 500;
const maxListHeightRatio = 4 / 5;

function getMaxLinesAndHeight(): {
  maxLineDisplayed: number;
  listHeightPx: number;
} {
  if (typeof window === "undefined") {
    return { maxLineDisplayed: 12, listHeightPx: lineHeight * 12 };
  }
  const listHeightPx = Math.max(
    minListHeightPx,
    maxListHeightRatio * window.innerHeight,
  );
  const maxLineDisplayed = Math.floor(listHeightPx / lineHeight);
  return { maxLineDisplayed, listHeightPx: maxLineDisplayed * lineHeight };
}

function LocationRow(props: {
  location: LocationIdentifier;
  sort: { order: SortOrder; column: string } | null;
  data: ILocationDetailedViewData;
  extensiveViewProps: IDetailedLocationListProps;
}) {
  const { location, sort, data, extensiveViewProps } = props;
  const isPinned = location in props.extensiveViewProps.config.pinnedLocations;
  const rowClasses = [
    listStyles.row,
    isPinned ? listStyles.pinnedLine : listStyles.contentLine,
  ].join(" ");

  const columnsToDisplay = columns.filter(
    (col) =>
      col.title === columns[0].title ||
      extensiveViewProps.config.columnVisibility[col.title],
  );
  const totalColumns = columnsToDisplay.reduce((sum, col) => sum + col.cols, 0);
  return (
    <div
      key={location}
      className={rowClasses}
      style={{
        gridTemplateColumns: `repeat(${totalColumns}, minmax(${minimalColumnWidth}px, 1fr))`,
        height: `${lineHeight}px`,
      }}
    >
      {columnsToDisplay.map((col, idx) => {
        const isFirstColumn = idx === 0;
        const isSelectedColumn = sort?.column === col.title;
        const cellClasses = [
          listStyles.contentCell,
          isFirstColumn ? listStyles.stickyColumn : "",
          isSelectedColumn ? listStyles.selectedColumn : "",
          "group",
        ].join(" ");
        return (
          <div
            key={col.title}
            className={cellClasses}
            style={{ gridColumn: `span ${col.cols}` }}
          >
            <col.displayComponent
              data={data}
              extensiveViewProps={extensiveViewProps}
            />
          </div>
        );
      })}
    </div>
  );
}

export function DetailedLocationList(props: IDetailedLocationListProps) {
  const [scrollY, setScrollY] = useState<number>(0);
  const [{ maxLineDisplayed, listHeightPx }, setMaxLinesAndHeight] =
    useState(getMaxLinesAndHeight);

  useEffect(() => {
    const update = () => setMaxLinesAndHeight(getMaxLinesAndHeight());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const columnsToDisplay = columns.filter(
    (col) =>
      col.title === columns[0].title ||
      props.config.columnVisibility[col.title],
  );
  const totalColumns = columnsToDisplay.reduce((sum, col) => sum + col.cols, 0);

  const {
    sortedItems,
    pinnedItems,
  }: {
    sortedItems: IDetailedLocationListProps["ownedLocations"];
    pinnedItems: IDetailedLocationListProps["ownedLocations"];
  } = useMemo(() => {
    const sortByFn =
      columns.find((col) => col.title === props.config.sort?.column)?.sortBy ??
      columns[0].sortBy;

    const sorted = Object.entries(props.ownedLocations).sort(([, a], [, b]) => {
      if (!sortByFn) return 0;
      const order = props.config.sort?.order ?? "asc";
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
  }, [props.ownedLocations, props.config]);

  const sortedCount = Object.keys(sortedItems).length;
  const pinnedCount = Object.keys(pinnedItems).length;
  const totalContentHeight = lineHeight * (1 + pinnedCount + sortedCount);

  const sortedContentOffset = lineHeight * (1 + pinnedCount);

  const sortedItemsVirtualized = useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor((scrollY - sortedContentOffset) / lineHeight),
    );
    const endIndex = Math.min(sortedCount, startIndex + maxLineDisplayed);
    return Object.fromEntries(
      Object.entries(sortedItems).slice(startIndex, endIndex),
    );
  }, [
    sortedItems,
    scrollY,
    sortedCount,
    sortedContentOffset,
    maxLineDisplayed,
  ]);

  const startIndex = Math.max(
    0,
    Math.floor((scrollY - sortedContentOffset) / lineHeight),
  );
  const endIndex = Math.min(sortedCount, startIndex + maxLineDisplayed);

  return (
    <div
      onScroll={({ currentTarget }) => setScrollY(currentTarget.scrollTop)}
      className={listStyles.gridContainer}
      style={{ scrollbarGutter: "stable", height: `${listHeightPx}px` }}
    >
      <div
        className={listStyles.gridContainerInner}
        style={{ height: `${totalContentHeight}px` }}
      >
        {/* Header Line */}
        <div
          className={`${listStyles.headerLine} ${listStyles.row}`}
          style={{
            height: `${lineHeight}px`,
            gridTemplateColumns: `repeat(${totalColumns}, minmax(128px, 1fr))`,
          }}
        >
          {columns
            .filter(
              (col) =>
                col.title === columns[0].title ||
                props.config.columnVisibility[col.title],
            )
            .map((col) => {
              const isFirstColumn = col.title === columns[0].title;
              const isSelectedColumn = props.config.sort?.column === col.title;
              const headerCellClasses = [
                listStyles.headerCell,
                isFirstColumn ? listStyles.stickyColumn : "",
                isSelectedColumn ? listStyles.selectedColumn : "",
              ].join(" ");
              return (
                <button
                  key={col.title}
                  type="button"
                  className={headerCellClasses}
                  style={{ gridColumn: `span ${col.cols}` }}
                  onClick={() => props.toggleSort?.(col.title)}
                >
                  <span>{col.title}</span>
                  {isSelectedColumn &&
                    (props.config.sort?.order === "asc" ? (
                      <FaAnglesUp color="white" size={16} />
                    ) : (
                      <FaAnglesDown color="white" size={16} />
                    ))}
                </button>
              );
            })}
        </div>
        {/* Sticky Lines (pinned content) */}
        {Object.entries(pinnedItems).length > 0 && (
          <div className={listStyles.pinnedBlock}>
            {Object.entries(pinnedItems).map(([locId, locData]) => (
              <LocationRow
                key={locId}
                location={locId}
                sort={props.config.sort}
                data={locData}
                extensiveViewProps={props}
              />
            ))}
          </div>
        )}

        <div className={listStyles.contentBlock}>
          {startIndex > 0 && (
            <div style={{ height: `${startIndex * lineHeight}px` }} />
          )}
          {sortedItems &&
            Object.entries(sortedItemsVirtualized).map(([locId, locData]) => (
              <LocationRow
                key={locId}
                location={locId}
                sort={props.config.sort}
                data={locData}
                extensiveViewProps={props}
              />
            ))}
          {endIndex < sortedCount && (
            <div
              style={{ height: `${(sortedCount - endIndex) * lineHeight}px` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
