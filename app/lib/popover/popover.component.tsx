"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { PopoverContext } from "@/app/lib/popover/popover.provider";
import popoverStyles from "./popover.module.css";
import { createPortal } from "react-dom";

export interface IPopoverRenderTriggerProps {
  isOpen: boolean;
  toggle: () => void;
}

export interface IPopoverProps {
  renderTrigger: (props: IPopoverRenderTriggerProps) => React.ReactNode;
  children: React.ReactNode;
  panelClassName?: string;
  placement?: "bottom" | "top" | "left" | "right";
}

export function Popover({
  renderTrigger,
  children,
  panelClassName = "",
  placement = "bottom",
}: IPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPositionStyle, setPanelPositionStyle] =
    useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const popoverContext = useContext(PopoverContext);

  const toggle = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    if (!isOpen || !popoverContext?.clickedElement) return;
    const insideTrigger = triggerRef.current?.contains(
      popoverContext.clickedElement,
    );
    const insidePanel = panelRef.current?.contains(
      popoverContext.clickedElement,
    );
    if (!insideTrigger && !insidePanel) {
      queueMicrotask(() => setIsOpen(false));
    }
  }, [popoverContext, isOpen]);

  useEffect(() => {
    if (isOpen && triggerRef.current && panelRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (placement) {
        case "top":
          top = triggerRect.top - panelRect.height - 8;
          left = triggerRect.left + triggerRect.width / 2 - panelRect.width / 2;
          break;
        case "bottom":
          top = triggerRect.bottom + 8;
          left = triggerRect.left + triggerRect.width / 2 - panelRect.width / 2;
          break;
        case "left":
          top = triggerRect.top + triggerRect.height / 2 - panelRect.height / 2;
          left = triggerRect.left - panelRect.width - 8;
          break;
        case "right":
          top = triggerRect.top + triggerRect.height / 2 - panelRect.height / 2;
          left = triggerRect.right + 8;
          break;
      }

      setPanelPositionStyle({
        top: Math.max(top, 0),
        left: Math.max(left, 0),
      });
    }
  }, [isOpen, placement]);

  return (
    <div>
      <div ref={triggerRef}>{renderTrigger({ isOpen, toggle })}</div>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className={["absolute", popoverStyles.panel, panelClassName].join(
              " ",
            )}
            style={panelPositionStyle}
          >
            {children}
          </div>,
          popoverContext?.rootElement ?? document.body,
        )}
    </div>
  );
}
