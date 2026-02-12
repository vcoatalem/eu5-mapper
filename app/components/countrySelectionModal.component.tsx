import { CountrySelectionList } from "@/app/components/countrySelectionList.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { ModalInstanceContext } from "@/app/lib/modal/modal.component";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { useContext, useRef, useState } from "react";


export function CountrySelectionModal() {

  const modal = useContext(ModalInstanceContext);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  if (!modal) {
    throw new Error("[CountrySelectionModal] must be used within a Modal");
  }

  return (
    <div className="flex flex-row px-2 py-1 w-[80vw] h-[75vh]">
      <CountrySelectionList
        className="w-[50%] flex-none"
        selectedCountry={selectedCountry ?? null}
        onSelect={(countryCode) => setSelectedCountry(countryCode)}
        onValidate={() => { gameStateController.reset(selectedCountry ?? undefined); modal.close(); }}
      ></CountrySelectionList>
      <div className="w-full px-2 py-1 block">
        <span className="w-fit" ref={containerRef} >
          <Tooltip config={{ offset: { x: 0, y: 0 } }}>
            <TooltipTrigger>
              <div className="w-full h-full bg-stone-800">{selectedCountry}</div>
            </TooltipTrigger>
            <TooltipContent anchor={{ type: "dom", ref: containerRef as React.RefObject<HTMLElement> }}>
              <div className="w-full h-full bg-stone-800">{selectedCountry}</div>
            </TooltipContent>
          </Tooltip>
        </span>
      </div>
    </div>

  )

}