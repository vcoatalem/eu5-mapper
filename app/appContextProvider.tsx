"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { createContext } from "react";
import { ISelectedLocationInfo } from "./lib/types";

interface IAppContext {
  selectedLocation: ISelectedLocationInfo | null;
  setSelectedLocation: Dispatch<SetStateAction<ISelectedLocationInfo | null>>;
  hoveredLocation: ISelectedLocationInfo | null;
  setHoveredLocation: Dispatch<SetStateAction<ISelectedLocationInfo | null>>;
}

const emptyContext = {} as IAppContext;

export const AppContext = createContext<IAppContext>(emptyContext);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedLocation, setSelectedLocation] =
    useState<ISelectedLocationInfo | null>(null);
  const [hoveredLocation, setHoveredLocation] =
    useState<ISelectedLocationInfo | null>(null);

  return (
    <AppContext.Provider
      value={{
        selectedLocation,
        setSelectedLocation,
        hoveredLocation,
        setHoveredLocation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
