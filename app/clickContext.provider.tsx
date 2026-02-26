"use client";

import { useState, createContext, useEffect, useCallback } from "react";


interface IClickContext {
  clickedElement: HTMLElement | null;
}

export const ClickContext = createContext<IClickContext | null>(null);

export function ClickContextProvider({ children }: { children: React.ReactNode }) {
  const [clickContext, setClickContext] = useState<IClickContext | null>(null);

  const handleClick = useCallback((e: MouseEvent) => {
    const el = e.target instanceof HTMLElement ? e.target : null;
    setClickContext({ clickedElement: el });
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