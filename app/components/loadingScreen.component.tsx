import { useContext, useEffect } from "react";
import { AppContext } from "../appContextProvider";

export function LoadingScreenComponent() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-64 w-64"></div>
    </div>
  );
}
