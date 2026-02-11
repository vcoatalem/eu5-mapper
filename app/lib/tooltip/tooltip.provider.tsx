import { createContext, useEffect, useMemo, useState } from "react";
import { ICoordinate } from "../types/general";

export interface ITooltipConfig {
  offset: ICoordinate;
  preferredHorizontal: "left" | "right";
  preferredVertical: "top" | "bottom";
  openDelay: number;
  closeDelay: number;
}

const defaultTooltipConfig: ITooltipConfig = {
  offset: { x: 10, y: 10 },
  preferredHorizontal: "right",
  preferredVertical: "top",
  openDelay: 500,
  closeDelay: 300,
};

interface ITooltipProviderContext {
  tooltipRoot: HTMLElement | null;
  defaultConfig: ITooltipConfig;
}

export const TooltipProviderContext =
  createContext<ITooltipProviderContext | null>(null);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [tooltipRoot, setTooltipRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTooltipRoot(document.getElementById("tooltip-root"));
  }, []);

  const value = useMemo(
    () => ({ tooltipRoot, defaultConfig: defaultTooltipConfig }),
    [tooltipRoot],
  );

  return (
    <TooltipProviderContext.Provider value={value}>
      <div id="tooltip-root"></div>
      {children}
    </TooltipProviderContext.Provider>
  );
}
