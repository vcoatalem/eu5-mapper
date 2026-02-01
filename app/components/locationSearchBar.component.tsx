import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { AppContext } from "../appContextProvider";
import { locationSearchController } from "@/app/lib/locationSearchController";
import { GuiElement } from "./guiElement";
import { actionEventDispatcher } from "@/app/lib/actionEventDispatcher";
import { ILocationIdentifier } from "../lib/types/general";

const LocationSearchResultItem = React.memo(function LocationSearchResultItem({
  loc,
}: {
  loc: {
    name: ILocationIdentifier;
    hierarchy: {
      area: string;
    };
  };
}) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = divRef.current;
    if (el) {
      console.log("[LocationSearchResultItem] registering action sources");
      actionEventDispatcher.registerHoverActionSource(
        el,
        () => loc.name,
        "search",
      );
      actionEventDispatcher.registerClickActionSource(
        el,
        () => loc.name,
        "goto",
      );
    }
    return () => {
      if (el) {
        console.log("[LocationSearchResultItem] unregistering action sources");
        actionEventDispatcher.clearEventListenersForElement(el);
      }
    };
  }, [loc.name]);

  return (
    <div
      ref={divRef}
      id={loc.name}
      className="hover:bg-stone-700 cursor-pointer px-1"
    >
      <span>{loc.name}</span>
      <span className="text-stone-500 italic"> ({loc.hierarchy.area})</span>
    </div>
  );
});

export function LocationSearchBar() {
  const { gameData } = useContext(AppContext);
  if (!gameData) {
    return <div></div>;
  }

  const locationSearchResult = useSyncExternalStore(
    locationSearchController.subscribe.bind(locationSearchController),
    () => locationSearchController.getSnapshot(),
  );

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="px-2 w-62">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search location..."
        className="w-full px-2 h-full"
        style={{ outline: "none" }}
        onChange={(e) => locationSearchController.search(e.target.value)}
      />
      <GuiElement
        className={
          " top-5 relative " +
          (!!locationSearchResult.locations.length &&
          inputRef.current === document.activeElement
            ? "visible"
            : "invisible")
        }
      >
        <div className="max-h-96 overflow-y-auto overflow-x-hidden w-full bg-black/90">
          {locationSearchResult.locations.map((loc) => (
            <LocationSearchResultItem key={loc.name} loc={loc} />
          ))}
        </div>
      </GuiElement>
    </div>
  );
}
