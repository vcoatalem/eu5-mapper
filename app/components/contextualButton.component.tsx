import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import {
  TooltipTrigger,
  TooltipTriggerChildProps,
} from "@/app/lib/tooltip/tooltipTrigger.component";
import { JSXElementConstructor, ReactElement, useRef } from "react";
import styles from "@/app/styles/button.module.css";

export function ContextualButton({
  isSelected,
  tooltip,
  children,
  onClick,
}: {
  isSelected?: boolean;
  tooltip: React.ReactNode;
  children: ReactElement<
    TooltipTriggerChildProps,
    string | JSXElementConstructor<any>
  >;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}) {
  const buttonDivRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={buttonDivRef}
      className={
        `h-full w-full ` +
        `ml-auto transition-opacity duration-50 ` +
        `opacity-0 pointer-events-none ` +
        `${isSelected ? " opacity-100 pointer-events-auto " : ""}` +
        ` group-hover:opacity-100 group-hover:pointer-events-auto`
      }
    >
      <Tooltip>
        <TooltipTrigger>
          <button
            onClick={onClick}
            className={
              `${styles.iconButton} ` +
              `${isSelected ? styles.buttonActive : ""}`
            }
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent
          anchor={{
            type: "dom",
            ref: buttonDivRef as React.RefObject<HTMLElement>,
          }}
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
