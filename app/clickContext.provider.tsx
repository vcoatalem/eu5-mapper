"use client";

import { useState, createContext, useEffect, useCallback } from "react";


interface IClickContext {
  clickedElement: HTMLElement | null;
}

export const ClickContext = createContext<IClickContext | null>(null);

export function ClickContextProvider({ children }: { children: React.ReactNode }) {
  const [clickContext, setClickContext] = useState<IClickContext | null>(null);

  const handleClick = useCallback((e: MouseEvent) => {
    setClickContext({ clickedElement: e.target as HTMLElement });
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [handleClick]);

  return (
    <ClickContext.Provider value={clickContext}>
      {children}
    </ClickContext.Provider>
  );
}