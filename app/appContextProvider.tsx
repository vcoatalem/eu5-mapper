"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { createContext } from "react";
import { ILocationIdentifier } from "./lib/types";

interface IAppContext {
  selectedLocation: ILocationIdentifier | null;
  setSelectedLocation: Dispatch<SetStateAction<ILocationIdentifier | null>>;
  hoveredLocation: ILocationIdentifier | null;
  setHoveredLocation: Dispatch<SetStateAction<ILocationIdentifier | null>>;
}

const emptyContext = {} as IAppContext;

export const AppContext = createContext<IAppContext>(emptyContext);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedLocation, setSelectedLocation] =
    useState<ILocationIdentifier | null>(null);
  const [hoveredLocation, setHoveredLocation] =
    useState<ILocationIdentifier | null>(null);

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
