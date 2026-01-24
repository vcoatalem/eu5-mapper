"use client";

import { Dispatch, SetStateAction, useState } from "react";
import { createContext } from "react";

interface IAppContext {
  mappingData: Record<string, string> | null;
  setMappingData: Dispatch<SetStateAction<Record<string, string> | null>>;
  selectedLocation: string | null;
  setSelectedLocation: Dispatch<SetStateAction<string | null>>;
}

const emptyContext = {} as IAppContext;

export const AppContext = createContext<IAppContext>(emptyContext);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
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
