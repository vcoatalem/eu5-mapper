"use client";

import { useState, createContext, useEffect, useCallback } from "react";

interface IPopoverContext {
  clickedElement: HTMLElement | null;
  rootElement?: HTMLElement | null;
}

export const PopoverContext = createContext<IPopoverContext | null>(null);

export function PopoverContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [popoverContext, setPopoverContext] = useState<IPopoverContext | null>(
    null,
  );

  const handleClick = useCallback((e: MouseEvent) => {
    const el = e.target instanceof HTMLElement ? e.target : null;
    setPopoverContext((prev) => ({ ...prev, clickedElement: el }));
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [handleClick]);

  useEffect(() => {
    const rootEl = document.getElementById("popover-root");
    setPopoverContext((prev) => ({
      clickedElement: prev?.clickedElement ?? null,
      rootElement: rootEl,
    }));
  }, []);

  return (
    <PopoverContext.Provider value={popoverContext}>
      <div id="popover-root" />
      {children}
    </PopoverContext.Provider>
  );
}
