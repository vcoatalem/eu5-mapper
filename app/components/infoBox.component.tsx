import { useContext } from "react";
import { AppContext } from "../appContextProvider";

export function InfoBoxComponent() {
  const context = useContext(AppContext);
  const nameToShow =
    context?.hoveredLocation?.name ?? context?.selectedLocation?.name;
  return (
    <div className="fixed bottom-5 left-5 rounded-sm min-w-64 min-h-32 flex flex-col z-10 bg-black border border-white text-md text-white p-2">
      <p>{nameToShow}</p>
    </div>
  );
}
