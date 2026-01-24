import { useContext } from "react";
import { AppContext } from "../app-context-provider";

export function InfoBoxComponent() {
  const context = useContext(AppContext);
  return (
    <div className="fixed bottom-5 right-5 rounded-md min-w-64 flex flex-col z-10 bg-white text-7xl">
      <p>{context?.selectedLocation}</p>
    </div>
  );
}
