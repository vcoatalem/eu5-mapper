"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { ClickContext } from "@/app/clickContext.provider";
import popoverStyles from "./popover.module.css";

export interface IPopoverRenderTriggerProps {
  isOpen: boolean;
  toggle: () => void;
}

export interface IPopoverProps {
  /** Render prop for the button/element that opens the popover. Receives isOpen and toggle. */
  renderTrigger: (props: IPopoverRenderTriggerProps) => React.ReactNode;
  /** Content projected into the popover panel. */
  children: React.ReactNode;
  /** Extra class names for the panel (e.g. "w-full gap-2"). */
  panelClassName?: string;
}

export function Popover({
  renderTrigger,
  children,
  panelClassName = "top-8",
}: IPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const clickContext = useContext(ClickContext);

  const toggle = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    if (!isOpen || !clickContext?.clickedElement) return;
    const insideTrigger = triggerRef.current?.contains(clickContext.clickedElement);
    const insidePanel = panelRef.current?.contains(clickContext.clickedElement);
    if (!insideTrigger && !insidePanel) {
      queueMicrotask(() => setIsOpen(false));
    }
  }, [clickContext, isOpen]);

  return (
    <div className="relative">
      <div ref={triggerRef}>{renderTrigger({ isOpen, toggle })}</div>
      {isOpen && (
        <div
          ref={panelRef}
          className={`${popoverStyles.panel} ${panelClassName}`.trim()}
        >
          {children}
        </div>
      )}
    </div>
  );
}
