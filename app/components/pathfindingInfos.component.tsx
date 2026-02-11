import { GuiElement } from "@/app/components/guiElement";
import { HashHelper } from "@/app/lib/utils/hash.helper";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Tooltip } from "../lib/tooltip/tooltip.component";
import { TooltipTrigger } from "../lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "../lib/tooltip/tooltipContent.component";

export function PathfindingInfosComponent({
  className,
}: {
  className?: string;
}) {
  /*   const [isFocused, setIdFocused] = useState(false); */
  const containerRef = useRef<HTMLDivElement>(null);

  const version = useParams().version as string;
  const versionUnderscored = version.replaceAll(".", "_");
  const gitHash = useMemo(() => HashHelper.getGitHash(), []);
  const s3url = `https://eu5-mapapp.s3.eu-west-1.amazonaws.com/test-results/${gitHash}/${versionUnderscored}/index.html`;

  /*   const handleMouseLeave = () => {
    setIdFocused(false);
  }; */

  return (
    <div ref={containerRef} className={className + " relative"}>
      <div className="hover:bg-stone-600 px-2 py-1 rounded-sm px-2 w-62 h-full relative">
        <Tooltip config={{ offset: { x: 24, y: 20 } }}>
          <TooltipTrigger>
            <a href={s3url} target="_blank">
              Game Data Version: {version}
            </a>
          </TooltipTrigger>
          <TooltipContent
            anchor={{
              type: "dom",
              ref: containerRef as React.RefObject<HTMLElement>,
            }}
          >
            <span>see performance report</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
