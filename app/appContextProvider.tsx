"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { createContext } from "react";
import { ILocationDataMap, ISelectedLocationInfo } from "./lib/types";

interface IAppContext {
  mappingData: ILocationDataMap | null;
  setMappingData: Dispatch<SetStateAction<ILocationDataMap | null>>; //TODO: mappingData might be better placed in a GameLogicRegistry app-wide singleton
  selectedLocation: ISelectedLocationInfo | null;
  setSelectedLocation: Dispatch<SetStateAction<ISelectedLocationInfo | null>>;
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
  const [mappingData, setMappingData] = useState<ILocationDataMap | null>(null);

  return (
    <AppContext.Provider
      value={{
        selectedLocation,
        setSelectedLocation,
        mappingData,
        setMappingData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
