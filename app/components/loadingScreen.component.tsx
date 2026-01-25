import { useContext, useEffect } from "react";
import { AppContext } from "../appContextProvider";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreenComponent({
  message = "Loading...",
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black z-50">
      <div className="flex flex-col items-center gap-6">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-64 w-64"></div>
        {message && (
          <p className="text-white text-lg text-center max-w-xs">{message}</p>
        )}
      </div>
    </div>
  );
}
