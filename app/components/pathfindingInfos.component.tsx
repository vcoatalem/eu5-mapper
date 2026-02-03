import { GuiElement } from "@/app/components/guiElement";
import { HashHelper } from "@/app/lib/utils/hash.helper";
import { useParams } from "next/navigation"
import { useMemo, useRef, useState } from "react";

export function PathfindingInfosComponent({ className }: { className?: string }) {

  const [isFocused, setIdFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const version = useParams().version as string;
  const versionUnderscored = version.replaceAll('.', '_')
  const gitHash = useMemo(() => HashHelper.getGitHash(), []);
  const s3url = `https://eu5-mapapp.s3.eu-west-1.amazonaws.com/test-results/${gitHash}/${versionUnderscored}/index.html`

  const handleMouseLeave = () => {
    setIdFocused(false);
  };

  return <div
    ref={containerRef}
    className={className + " relative"}
    onMouseLeave={handleMouseLeave}
    >
    <div className="hover:bg-stone-600 px-2 py-1 rounded-sm px-2 w-62 h-full relative"
      onMouseEnter={() => setIdFocused(true)}
    >
      Game Data Version: {version}
      {isFocused && (
        <GuiElement className="absolute top-full left-0 z-50 w-50">
          <div onMouseEnter={() => setIdFocused(true)}>
            <a href={s3url} target="_blank">View Performance Report</a>
          </div>
        </GuiElement>
      )}
    </div>
   
  </div>
}