import { AppContext } from "@/app/appContextProvider";
import { RoadStepper } from "@/app/components/roads/roadStepper.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ObjectHelper } from "@/app/lib/object.helper";
import { RoadKey, RoadType, ZodRoadKey } from "@/app/lib/types/roads";
import React, { useContext, useMemo, useSyncExternalStore } from "react";
import { IoSearch } from "react-icons/io5";
import { ActionSource } from "../../lib/actionSource.component";
import { RoadsHelper } from "../../lib/roads.helper";
import { Tooltip } from "../../lib/tooltip/tooltip.component";
import { TooltipContent } from "../../lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "../../lib/tooltip/tooltipTrigger.component";
import { StringHelper } from "../../lib/utils/string.helper";
import { RoadBulkActionPopover } from "@/app/components/roads/roadBulkActionPopover.component";

const RoadItem = React.memo(function RoadItem({
  roadKey,
  type,
}: {
  roadKey: RoadKey;
  type: RoadType;
}) {
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const [from, to] = roadKey.split("-");

  if (!from || !to) {
    return <></>;
  }
  return (
    <div
      key={roadKey}
      className="py-1 h-10 flex flex-row items-center whitespace-nowrap gap-4"
    >
      <span ref={spanRef} className="flex-1 truncate ...">
        <Tooltip config={{ openDelay: 1000 }}>
          <TooltipTrigger>
            <ActionSource
              locations={(e) => [from, to]}
              hover={{}}
              click={{ type: "goto" }}
            >
              <span className={"cursor-pointer"}>
                {from} - {to}
              </span>
            </ActionSource>
          </TooltipTrigger>

          <TooltipContent
            anchor={{
              type: "dom",
              ref: spanRef,
            }}
          >
            {from} - {to}
          </TooltipContent>
        </Tooltip>
      </span>

      <RoadStepper roadKey={roadKey} roadType={type} />
    </div>
  );
});

export function RoadList({ className }: { className?: string }) {
  const { gameData } = useContext(AppContext);
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const [search, setSearch] = React.useState<string | null>(null);

  const baseRoads = gameData?.roads ?? {};
  const stateRoads = gameState?.roads ?? {};

  const filteredRoadsEntries = useMemo(() => {
    const entries = RoadsHelper.getOwnedRoads(
      gameState?.ownedLocations ?? {},
      baseRoads,
      stateRoads,
    );
    if (!search) {
      return entries;
    }

    for (const [key] of ObjectHelper.getTypedEntries(entries)) {
      const [from, to] = key.split("-");
      const fromContains = StringHelper.isInSearchQuery(from, search);
      const toContains = StringHelper.isInSearchQuery(to, search);
      const fromScore = fromContains ? search.length / from.length : 0;
      const toScore = toContains ? search.length / to.length : 0;
      const keyMatched: "from" | "to" = fromScore >= toScore ? "from" : "to";
      if (keyMatched === "from") {
        delete entries[key];
      } else if (keyMatched === "to") {
        const type = entries[key];
        delete entries[key];
        const newKey = ZodRoadKey.parse(`${to}-${from}`);
        entries[newKey] = type;
      }
    }
    return entries;
  }, [search, gameState?.ownedLocations, baseRoads, stateRoads]);

  if (!filteredRoadsEntries) return null;
  return (
    <div className={[className, " "].filter(Boolean).join(" ")}>
      <div className="shrink-0 flex flex-row items-center pt-1">
        <IoSearch color="white" size={24}></IoSearch>
        <input
          type="search"
          placeholder="Search for a location..."
          className="w-full ml-2"
          onChange={(e) => setSearch(e.target.value)}
          style={{ outline: "none" }}
        />
        <RoadBulkActionPopover></RoadBulkActionPopover>
      </div>
      <hr className="mt-2 mb-1"></hr>
      <div className="flex flex-col gap-1 overflow-y-scroll max-h-[60vh] pb-16">
        {" "}
        {/* // max height is set here to avoid overflow of the list in the context of the gui. Find something */}
        {ObjectHelper.getTypedEntries(filteredRoadsEntries)
          .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
          .map(([key, type]) => (
            <RoadItem key={key} roadKey={key} type={type} />
          ))}
      </div>
    </div>
  );
}
