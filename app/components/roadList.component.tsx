import React, { useMemo, useSyncExternalStore } from "react";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ConstructibleHelper } from "../lib/constructible.helper";
import { StringHelper } from "../lib/utils/string.helper";
import { RoadType } from "../lib/types/general";
import { getGuiImage } from "../lib/drawing/namedGuiImagesMap.const";
import { ActionSource } from "../lib/actionSource.component";
import Image from "next/image";
import { Tooltip } from "../lib/tooltip/tooltip.component";
import { TooltipTrigger } from "../lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "../lib/tooltip/tooltipContent.component";
import buttonStyles from "../styles/button.module.css";

interface IRoadListProps {}

const RoadItem = React.memo(function RoadItem({
  roadKey,
  type,
}: {
  roadKey: `${string}-${string}`;
  type: RoadType;
}) {
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const [from, to] = roadKey.split("-");
  const upgradeType = useMemo(() => {
    switch (type) {
      case "gravel_road":
        return "paved_road";
      case "paved_road":
        return "modern_road";
      case "modern_road":
        return "rail_road";
      case "rail_road":
        return null;
    }
  }, [type]);
  const downgradeType = useMemo(() => {
    switch (type) {
      case "gravel_road":
        return null;
      case "paved_road":
        return "gravel_road";
      case "modern_road":
        return "paved_road";
      case "rail_road":
        return "modern_road";
    }
  }, [type]);

  if (!from || !to) {
    return <></>;
  }
  return (
    <div
      key={roadKey}
      className="py-1 h-10 flex flex-row items-center whitespace-nowrap gap-4"
    >
      <span ref={spanRef} className="min-w-0 max-w-32 truncate ...">
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
              ref: spanRef as React.RefObject<HTMLElement>,
            }}
          >
            {from} - {to}
          </TooltipContent>
        </Tooltip>
      </span>

      <span className="col-span-1">
        <img src={getGuiImage(type)} alt={type} width={24} height={24} />
      </span>

      <div className="flex flex-none flex-row gap-1">
        {upgradeType && (
          <button
            className={buttonStyles.iconButton}
            onClick={() =>
              gameStateController.changeRoadType(roadKey, upgradeType)
            }
          >
            <Image
              src="/icons/arrow-up.svg"
              alt="Upgrade"
              width={24}
              height={24}
              className="invert"
            />
          </button>
        )}

        {downgradeType && (
          <button
            className={buttonStyles.iconButton}
            onClick={() =>
              gameStateController.changeRoadType(roadKey, downgradeType)
            }
          >
            <Image
              src="/icons/arrow-down.svg"
              alt="Downgrade"
              width={24}
              height={24}
              className="invert"
            />
          </button>
        )}
      </div>
    </div>
  );
});

export function RoadList(props: IRoadListProps) {
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const [search, setSearch] = React.useState<string | null>(null);

  const filteredRoadsEntries = useMemo(() => {
    const entries = ConstructibleHelper.getOwnedRoads(
      gameState?.ownedLocations ?? {},
      gameState?.roads ?? {},
    );
    if (!search) {
      return entries;
    }

    for (const [key] of Object.entries(entries)) {
      const [from, to] = key.split("-");
      const fromContains = StringHelper.isInSearchQuery(from, search);
      const toContains = StringHelper.isInSearchQuery(to, search);
      const fromScore = fromContains ? search.length / from.length : 0;
      const toScore = toContains ? search.length / to.length : 0;
      const keyMatched: "from" | "to" = fromScore >= toScore ? "from" : "to";
      if (keyMatched === "from") {
        delete entries[key as keyof typeof entries];
      } else if (keyMatched === "to") {
        const type = entries[key];
        delete entries[key];
        const newKey = `${to}-${from}`;
        entries[newKey] = type;
      }
    }
    return entries;
  }, [search, gameState.ownedLocations, gameState.roads]);

  if (!filteredRoadsEntries) return null;
  return (
    <div>
      <div className="shrink-0 flex flex-row pt-1">
        <Image
          src={"/icons/magnifyingGlass.svg"}
          alt="search"
          width={16}
          height={16}
          className="invert"
        />
        <input
          type="search"
          placeholder="Search for a location..."
          className="w-full ml-2"
          onChange={(e) => setSearch(e.target.value)}
          style={{ outline: "none" }}
        />
      </div>
      <div>
        {Object.entries(filteredRoadsEntries)
          .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
          .map(([key, type]) => (
            <RoadItem
              key={key}
              roadKey={key as `${string}-${string}`}
              type={type}
            />
          ))}
      </div>
    </div>
  );
}
