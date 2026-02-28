"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { ClickContext } from "@/app/clickContext.provider";
import popoverStyles from "./popover.module.css";

export interface IPopoverRenderTriggerProps {
  isOpen: boolean;
  toggle: () => void;
}

export interface IPopoverProps {
  renderTrigger: (props: IPopoverRenderTriggerProps) => React.ReactNode;
  children: React.ReactNode;
  panelClassName?: string;
  placement: "bottom" | "top";
}

export function Popover({
  renderTrigger,
  children,
  panelClassName = "",
  placement = "bottom",
}: IPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const clickContext = useContext(ClickContext);

  const toggle = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    if (!isOpen || !clickContext?.clickedElement) return;
    const insideTrigger = triggerRef.current?.contains(
      clickContext.clickedElement,
    );
    const insidePanel = panelRef.current?.contains(clickContext.clickedElement);
    if (!insideTrigger && !insidePanel) {
      queueMicrotask(() => setIsOpen(false));
    }
  }, [clickContext, isOpen]);

  const positionStyle =
    placement === "top"
      ? {
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: "8px",
        }
      : {
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: "8px",
        };

  return (
    <div className="relative bottom-full">
      <div ref={triggerRef}>{renderTrigger({ isOpen, toggle })}</div>
      {isOpen && (
        <div
          ref={panelRef}
          className={["absolute", popoverStyles.panel, panelClassName].join(
            " ",
          )}
          style={positionStyle}
        >
          {children}
        </div>
      )}
    </div>
  );
}
