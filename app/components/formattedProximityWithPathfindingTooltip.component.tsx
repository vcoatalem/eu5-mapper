import { FormatedProximity } from "@/app/components/formatedProximity.component";
import { ShortestPathComponent } from "@/app/components/shortestPath.component";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { LocationIdentifier } from "@/app/lib/types/general";
import { useRef } from "react";

interface IFormattedProximityWithPathfindingTooltip {
  className?: string;
  location: LocationIdentifier;
  proximity: number;
}

export function FormattedProximityWithPathfindingTooltip(
  props: IFormattedProximityWithPathfindingTooltip,
) {
  const divRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={divRef} className="col-span-1">
      <Tooltip config={{ preferredVertical: "top" }}>
        <TooltipTrigger>
          <FormatedProximity
            proximity={props.proximity}
            className="cursor-pointer"
          ></FormatedProximity>
        </TooltipTrigger>
        <TooltipContent
          anchor={{
            type: "dom",
            ref: divRef,
          }}
        >
          <ShortestPathComponent
            location={props.location}
          ></ShortestPathComponent>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
