import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ITooltipConfig, TooltipProviderContext } from "./tooltip.provider";

interface ITooltipProps {
  config?: Partial<ITooltipConfig>;
  forceOpen?: boolean; // override base behavior
  children: React.ReactNode;
}

interface ITooltipInstanceContext {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  config: ITooltipConfig;
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
  const triggerRef = useRef<HTMLElement | null>(null);
  const openTimeout = useRef<number | null>(null);
  const closeTimeout = useRef<number | null>(null);
  const open = () => {
    if (props.forceOpen) return;
    if (closeTimeout.current) window.clearTimeout(closeTimeout.current);
    openTimeout.current = window.setTimeout(
      () => setIsOpen(true),
      mergedConfig.openDelay,
    );
  };

  const close = () => {
    if (props.forceOpen) return;
    if (openTimeout.current) window.clearTimeout(openTimeout.current);
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

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      triggerRef,
      config: mergedConfig,
    }),
    [isOpen, mergedConfig],
  );

  return (
    <TooltipInstanceContext.Provider value={value}>
      {props.children}
    </TooltipInstanceContext.Provider>
  );
}
