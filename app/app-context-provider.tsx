"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { createContext } from "react";

export interface ILocation {
  name: string;
  colorHex: string;
}

interface IAppContext {
  mappingData: Record<string, string> | null;
  setMappingData: Dispatch<SetStateAction<Record<string, string> | null>>;
  selectedLocation: ILocation | null;
  setSelectedLocation: Dispatch<SetStateAction<ILocation | null>>;
}

const emptyContext = {} as IAppContext;

export const AppContext = createContext<IAppContext>(emptyContext);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedLocation, setSelectedLocation] = useState<ILocation | null>(
    null
  );
  const [mappingData, setMappingData] = useState<Record<string, string> | null>(
    null
  );

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
