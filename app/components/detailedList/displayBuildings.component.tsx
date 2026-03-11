import { BuildingDescription } from "@/app/components/buildingDescription.component";
import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { actionsMetadata } from "@/app/components/detailedList/detailedList.config";
import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { gameStateController } from "@/app/lib/gameState.controller";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { ConstructibleState } from "@/app/lib/types/constructibleState";
import { LocationIdentifier } from "@/app/lib/types/general";
import Image from "next/image";
import { useRef } from "react";

function DisplayBuilding(props: {
  location: LocationIdentifier;
  buildingTemplateName: string;
  buildingData: ConstructibleState[string];
}) {
  const { instance, possibleActions } = props.buildingData;
  const hasInstance = !!instance;
  const divRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={divRef}
      className={
        " flex flex-row items-center gap-1 rounded-md justify-center px-2 py-1 h-fit " +
        ((hasInstance && " bg-yellow-500/50") || " border border-stone-400 ")
      }
    >
      <Tooltip config={{ offset: { x: 0, y: 10 } }}>
        <TooltipTrigger>
          <div className="relative">
            <Image
              src={`/gui/buildings/${props.buildingTemplateName}.png`}
              alt={props.buildingTemplateName}
              width={28}
              height={28}
            />
            {hasInstance && instance?.template.cap === null && (
              <span className="text-white absolute bottom-0 left-[1/4] px-1 rounded-md backdrop-blur-md text-xs">
                {instance?.level}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent anchor={{ type: "dom", ref: divRef }}>
          <BuildingDescription
            buildingTemplateName={props.buildingTemplateName}
            instance={instance}
          ></BuildingDescription>
        </TooltipContent>
      </Tooltip>

      {possibleActions.map((action) => {
        const actionKey = `${props.location}-${props.buildingTemplateName}-${action.type}`;
        return (
          <ButtonWithTooltip
            key={actionKey}
            tooltip={actionsMetadata[action.type].tooltip}
            onClick={() =>
              gameStateController.handleBuildingAction(props.location, action)
            }
            isActive={hasInstance}
          >
            <span>{actionsMetadata[action.type].icon}</span>
          </ButtonWithTooltip>
        );
      })}
    </div>
  );
}

export function DisplayBuildings(props: { data: ILocationDetailedViewData }) {
  return (
    <div className="flex flex-row w-full h-full gap-2 items-center ">
      {Object.entries(props.data.constructibleState).map(
        ([buildingTemplateName, { instance, possibleActions }]) => {
          const key = `${props.data.baseLocationGameData.name}-${buildingTemplateName}`;
          return (
            <DisplayBuilding
              location={props.data.baseLocationGameData.name}
              key={key}
              buildingTemplateName={buildingTemplateName}
              buildingData={{ instance, possibleActions }}
            ></DisplayBuilding>
          );
        },
      )}
    </div>
  );
}
