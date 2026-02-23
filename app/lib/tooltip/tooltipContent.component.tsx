import { useContext, useLayoutEffect, useRef, useState } from "react";
import { TooltipInstanceContext } from "./tooltip.component";
import { TooltipProviderContext } from "./tooltip.provider";
import { createPortal } from "react-dom";
import { ICoordinate } from "../types/general";
import { cameraController } from "../cameraController";
import styles from "./tooltip.module.css";

interface ITooltipDomAnchor {
  type: "dom";
  ref: React.RefObject<HTMLElement>;
}

interface ITooltipCoordinateAnchor {
  type: "coordinate";
  coordinate: ICoordinate;
}

interface ITooltipContentProps {
  children: React.ReactNode;
  anchor: ITooltipDomAnchor | ITooltipCoordinateAnchor;
}

export function TooltipContent(props: ITooltipContentProps) {
  const tooltipInstanceContext = useContext(TooltipInstanceContext);
  const tooltipProviderContext = useContext(TooltipProviderContext);
  const [position, setPosition] = useState<ICoordinate | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  if (!tooltipInstanceContext) {
    throw new Error("[TooltipContent] must be used within a Tooltip");
  }
  if (!tooltipProviderContext) {
    throw new Error("[TooltipContent] must be used within a TooltipProvider");
  }

  useLayoutEffect(() => {
    if (!tooltipInstanceContext.isOpen || !contentRef.current) {
      queueMicrotask(() => setPosition(null));
      return;
    }

    const contentRect = contentRef.current.getBoundingClientRect();
    const contentWidth = contentRect.width;
    const contentHeight = contentRect.height;

    let placement: ICoordinate | null = null;

    if (props.anchor.type === "dom") {
      const anchorRect = props.anchor.ref.current?.getBoundingClientRect();
      const anchorCoordinate: ICoordinate = anchorRect
        ? {
            // Use the visual center of the anchor element as the anchor point
            x: anchorRect.left + anchorRect.width / 2,
            y: anchorRect.top + anchorRect.height / 2,
          }
        : {
            // If we can't measure the anchor, fall back to top-left of tooltip itself
            x: contentRect.left,
            y: contentRect.top,
          };

      placement = cameraController.getTooltipScreenPositionForScreenCoordinate(
        anchorCoordinate,
        tooltipInstanceContext.config.offset,
        { x: contentWidth, y: contentHeight },
        tooltipInstanceContext.mouseCoordinates,
      );
    } else {
      // props.anchor.type === "coordinate" (game/map coordinates)
      placement = cameraController.getTooltipScreenPositionForLocation(
        props.anchor.coordinate,
        tooltipInstanceContext.config.offset,
        { x: contentWidth, y: contentHeight },
        tooltipInstanceContext.mouseCoordinates,
      );
    }

    setPosition(placement);
  }, [
    props.anchor,
    tooltipInstanceContext.config.offset,
    tooltipInstanceContext.isOpen,
  ]);

  if (!tooltipInstanceContext.isOpen) {
    return null;
  }

  if (!tooltipProviderContext.tooltipRoot) {
    throw new Error("[TooltipContent] could not find tooltip root element");
  }

  const style: React.CSSProperties = {
    left: position?.x ?? 0,
    top: position?.y ?? 0,
  };

  return createPortal(
    <div ref={contentRef} style={style} className={styles.tooltip}>
      {props.children}
    </div>,
    tooltipProviderContext.tooltipRoot,
  );
}
