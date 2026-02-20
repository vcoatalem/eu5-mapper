import React, {
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppContext } from "../appContextProvider";
import {
  ILocationSearchResult,
  locationSearchController,
} from "@/app/lib/locationSearchController";
import { GuiElement } from "./guiElement";
import { ActionSource } from "@/app/lib/actionSource.component";
import { StringHelper } from "@/app/lib/utils/string.helper";
import { IoSearch } from "react-icons/io5";

const LocationSearchResultItem = React.memo(function LocationSearchResultItem({
  locationSearchResult,
}: {
  locationSearchResult: ILocationSearchResult["locations"][0];
}) {
  return (
    <ActionSource
      locations={() => locationSearchResult.locationsInHierarchy}
      hover={{ type: "search" }}
      click={{ type: "goto" }}
    >
      <div
        id={locationSearchResult.name}
        className="hover:bg-stone-700 cursor-pointer px-1"
      >
        <span>
          {StringHelper.formatLocationName(locationSearchResult.name)}
        </span>
        <span className="text-stone-500 italic">
          {" "}
          ({locationSearchResult.hierarchyType})
        </span>
      </div>
    </ActionSource>
  );
});

export function LocationSearchBar(props: { className?: string }) {
  const { gameData } = useContext(AppContext);
  const locationSearchResult = useSyncExternalStore(
    locationSearchController.subscribe.bind(locationSearchController),
    () => locationSearchController.getSnapshot(),
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  if (!gameData) {
    return <div></div>;
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && dropdownRef.current?.contains(relatedTarget)) {
      return;
    }
    // Delay hiding to allow click events to fire first
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        setIsFocused(false);
      }
    }, 150);
  };

  const handleDropdownMouseDown = (e: React.MouseEvent) => {
    // Prevent input from losing focus when clicking on dropdown
    e.preventDefault();
  };

  const handleMouseLeave = () => {
    setIsFocused(false);
  };

  return (
    <div
      className={
        props.className + " px-2 max-w-62 h-full flex items-center relative "
      }
      onMouseLeave={handleMouseLeave}
    >
      <IoSearch color="white" size={24}></IoSearch>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search location..."
        className="w-full px-2 h-full"
        style={{ outline: "none" }}
        onChange={(e) => {
          locationSearchController.search(e.target.value);
          setIsFocused(true);
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
      />
      <GuiElement
        className={
          "absolute top-full left-2 right-2 z-50 " +
          (!!locationSearchResult.locations.length && isFocused
            ? "visible"
            : "invisible")
        }
      >
        <div
          ref={dropdownRef}
          className="max-h-96 overflow-y-auto overflow-x-hidden w-full bg-black/90"
          onMouseDown={handleDropdownMouseDown}
        >
          {locationSearchResult.locations.map((locationSearchResult) => (
            <LocationSearchResultItem
              key={`${locationSearchResult.name}-${locationSearchResult.hierarchyType}`}
              locationSearchResult={locationSearchResult}
            />
          ))}
        </div>
      </GuiElement>
    </div>
  );
}
