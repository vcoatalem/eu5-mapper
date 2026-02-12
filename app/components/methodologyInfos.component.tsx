import { HashHelper } from "@/app/lib/utils/hash.helper";
import { useParams } from "next/navigation";
import { useMemo, useRef } from "react";
import { Tooltip } from "../lib/tooltip/tooltip.component";
import { TooltipTrigger } from "../lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "../lib/tooltip/tooltipContent.component";
import Image from "next/image";

export function MethodologyInfos({
  className = "",
}: {
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const version = useParams().version as string;
  const versionUnderscored = version.replaceAll(".", "_");
  const gitHash = useMemo(() => HashHelper.getGitHash(), []);
  const s3url = useMemo(
    () =>
      `https://eu5-mapapp.s3.eu-west-1.amazonaws.com/test-results/${gitHash}/${versionUnderscored}/index.html`,
    [gitHash, versionUnderscored],
  );

  return (
    <div ref={containerRef} className={"hover:bg-stone-600 h-fit px-2 py-1 rounded-sm h-full relative cursor-pointer " + className}>
      <Tooltip config={{ offset: { x: 12, y: 10 } }}>
        <TooltipTrigger>
          <a href={s3url} target="_blank" className="flex items-center h-full w-full gap-1">
          <Image src="/icons/question.svg" alt="question" width={16} height={16} className="invert"/>
            <span className="text-sm">Methodology</span>
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
  );
}
