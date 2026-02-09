"use client";

import React, { useState } from "react";

export interface ExpandablePanelProps {
  collapsedWidth?: string;
  expandedWidth?: string;
  children: (isExpanded: boolean) => React.ReactNode;
}

const DEFAULT_COLLAPSED_WIDTH = "w-52";
const DEFAULT_EXPANDED_WIDTH = "w-[600px]";
const BORDER_THRESHOLD = 20;

export function ExpandablePanel({
  collapsedWidth = DEFAULT_COLLAPSED_WIDTH,
  expandedWidth = DEFAULT_EXPANDED_WIDTH,
  children,
}: ExpandablePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX;
    const distanceFromLeft = mouseX - rect.left;
    const distanceFromRight = rect.right - mouseX;

    if (!isExpanded) {
      if (distanceFromRight >= 0 && distanceFromRight <= BORDER_THRESHOLD) {
        setIsExpanded(true);
      }
    } else {
      if (distanceFromLeft >= 0 && distanceFromLeft <= BORDER_THRESHOLD) {
        setIsExpanded(false);
      }
    }
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
  };

  return (
    <div
      ref={containerRef}
      className={`max-h-96 ${isExpanded ? expandedWidth : collapsedWidth} overflow-y-auto overflow-x-hidden max-h-[50vh] transition-[width] duration-300 ease-in-out flex flex-col`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children(isExpanded)}
    </div>
  );
}
