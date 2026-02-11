import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ITooltipConfig, TooltipProviderContext } from "./tooltip.provider";
import { ICoordinate } from "../types/general";

interface ITooltipProps {
  config?: Partial<ITooltipConfig>;
  forceOpen?: boolean; // override base behavior
  children: React.ReactNode;
  mouseCoordinates?: ICoordinate; // allow manually setting mouse coordinates for tooltip positioning when forceOpen is true
}

interface ITooltipInstanceContext {
  isOpen: boolean;
  open: (e: React.MouseEvent) => void;
  close: (e: React.MouseEvent) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  config: ITooltipConfig;
  mouseCoordinates: ICoordinate;
}

export const TooltipInstanceContext =
  createContext<ITooltipInstanceContext | null>(null);

export function Tooltip(props: ITooltipProps) {
  const tooltipProviderContext = useContext(TooltipProviderContext);
  if (!tooltipProviderContext) {
    throw new Error("Tooltip must be used within a TooltipProvider");
  }
  const { defaultConfig } = tooltipProviderContext;
  const mergedConfig: ITooltipConfig = {
    ...defaultConfig,
    ...props.config,
  };
  const [isOpen, setIsOpen] = useState(false);
  const [mouseCoordinates, setMouseCoordinates] = useState<ICoordinate | null>(
    null,
  );
  const triggerRef = useRef<HTMLElement | null>(null);
  const openTimeout = useRef<number | null>(null);
  const closeTimeout = useRef<number | null>(null);
  const open = (e: React.MouseEvent) => {
    if (props.forceOpen) return;
    if (closeTimeout.current) window.clearTimeout(closeTimeout.current);
    setMouseCoordinates({ x: e.clientX, y: e.clientY });
    openTimeout.current = window.setTimeout(
      () => setIsOpen(true),
      mergedConfig.openDelay,
    );
  };

  const close = (e: React.MouseEvent) => {
    if (props.forceOpen) return;
    if (openTimeout.current) window.clearTimeout(openTimeout.current);
    setMouseCoordinates({ x: e.clientX, y: e.clientY });
    closeTimeout.current = window.setTimeout(
      () => setIsOpen(false),
      mergedConfig.closeDelay,
    );
  };

  useEffect(() => {
    if (props.forceOpen) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [props.forceOpen]);

  useEffect(() => {
    if (props.mouseCoordinates) {
      setMouseCoordinates(props.mouseCoordinates);
    }
  }, [props.mouseCoordinates]);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      triggerRef,
      config: mergedConfig,
      mouseCoordinates: mouseCoordinates ?? { x: 0, y: 0 },
    }),
    [isOpen, mergedConfig, mouseCoordinates],
  );

  return (
    <TooltipInstanceContext.Provider value={value}>
      {props.children}
    </TooltipInstanceContext.Provider>
  );
}
