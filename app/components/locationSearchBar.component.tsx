import { useContext, useSyncExternalStore } from "react";
import { AppContext } from "../appContextProvider";
import { locationSearchController } from "@/app/lib/locationSearchController";
import { GuiElement } from "./guiElement";

export function LocationSearchBar() {
  const { gameData } = useContext(AppContext);
  if (!gameData) {
    return <div></div>;
  }

  const locationSearchResult = useSyncExternalStore(
    locationSearchController.subscribe.bind(locationSearchController),
    () => locationSearchController.getSnapshot(),
  );

  console.log("render LocationSearchBar", locationSearchResult);

  return (
    <div className="px-2 w-62">
      <input
        type="text"
        placeholder="Search location..."
        className="w-full px-2 h-full"
        style={{ outline: "none" }}
        onChange={(e) => locationSearchController.search(e.target.value)}
      />
      {locationSearchResult.locations.length > 0 && (
        <GuiElement className="top-5 relative">
          <div className="max-h-96 overflow-y-auto overflow-x-hidden w-full bg-black/90">
            {locationSearchResult.locations.map((loc) => (
              <div
                key={loc.name}
                className="hover:bg-stone-700 cursor-pointer px-1"
              >
                <span>{loc.name}</span>
                <span className="text-stone-500 italic">
                  {" "}
                  ({loc.hierarchy.area})
                </span>
              </div>
            ))}
          </div>
        </GuiElement>
      )}
    </div>
  );
}
