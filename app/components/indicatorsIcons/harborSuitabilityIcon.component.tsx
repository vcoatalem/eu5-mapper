import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import Image from "next/image";
import { useRef } from "react";

const DEFAULT_TOOLTIP = "Harbor Suitability";

export function HarborSuitabilityIcon({ className, size = 24, tooltip }: { className?: string, size?: number, tooltip?: string }) {
  const divRef = useRef<HTMLDivElement>(null);

  return <div className={`cursor-help ${className ?? ""}`.trim()} ref={divRef}>
    <Tooltip>
      <TooltipTrigger>
        <Image src="/gui/icons/harbor_capacity.png" alt="Harbor Suitability" width={size} height={size} />
      </TooltipTrigger>
      <TooltipContent anchor={{ type: "dom", ref: divRef as React.RefObject<HTMLElement> }}>
        <span>{tooltip ?? DEFAULT_TOOLTIP}</span>
      </TooltipContent>
    </Tooltip>
  </div>
}
