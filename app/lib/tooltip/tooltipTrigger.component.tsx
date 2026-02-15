import React, { cloneElement, useContext } from "react";
import { TooltipInstanceContext } from "./tooltip.component";

export type TooltipTriggerChildProps = {
  ref: React.Ref<HTMLElement>;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
};

interface ITooltipTriggerProps {
  children: React.ReactElement<TooltipTriggerChildProps>;
}

export function TooltipTrigger({ children }: ITooltipTriggerProps) {
  const tooltipInstanceContext = useContext(TooltipInstanceContext);
  if (!tooltipInstanceContext) {
    throw new Error("TooltipTrigger must be used within a Tooltip");
  }
  const { open, close, triggerRef } = tooltipInstanceContext;

  return cloneElement(
    children as React.ReactElement<TooltipTriggerChildProps>,
    {
      ref: triggerRef,
      onMouseEnter: (e: React.MouseEvent) => {
        children.props.onMouseEnter?.(e);
        open(e);
      },
      onMouseLeave: (e: React.MouseEvent) => {
        children.props.onMouseLeave?.(e);
        close(e);
      },
    },
  );
}
