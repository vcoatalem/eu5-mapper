import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { RoadKey, RoadType } from "@/app/lib/types/roads";
import { useMemo, useRef } from "react";
import { FaAnglesDown, FaAnglesUp } from "react-icons/fa6";
import { gameStateController } from "@/app/lib/gameState.controller";
import { getRoadIcon } from "@/app/lib/drawing/getImages";
import Image from "next/image";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";

interface IRoadStepperProps {
  roadKey: RoadKey;
  roadType: RoadType | null;
  className?: string;
}

export function RoadStepper({
  roadKey,
  roadType,
  className,
}: IRoadStepperProps) {
  const divRef = useRef<HTMLDivElement>(null);

  const upgradeType = useMemo(() => {
    switch (roadType) {
      case "gravel_road":
        return "paved_road";
      case "paved_road":
        return "modern_road";
      case "modern_road":
        return "rail_road";
      case "rail_road":
        return null;
      case null:
        return "gravel_road";
      default:
        return null;
    }
  }, [roadType]);
  const downgradeType = useMemo(() => {
    switch (roadType) {
      case "gravel_road":
        return null;
      case "paved_road":
        return "gravel_road";
      case "modern_road":
        return "paved_road";
      case "rail_road":
        return "modern_road";
      default:
        return null;
    }
  }, [roadType]);

  return (
    <div
      className={[
        "flex flex-row items-center gap-1 shrink-0 min-w-[7rem]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ButtonWithTooltip
        className="ml-auto"
        disabled={roadType === null}
        tooltip={
          downgradeType ? "Downgrade road to " + downgradeType : "destroy road"
        }
        onClick={() =>
          gameStateController.changeRoadType(roadKey, downgradeType)
        }
      >
        <FaAnglesDown color="white" size={12}></FaAnglesDown>
      </ButtonWithTooltip>

      <p
        ref={divRef}
        className="inline-flex shrink-0 cursor-help relative"
        style={{ filter: roadType === null ? "grayscale(100%)" : "none" }}
      >
        <Tooltip>
          <TooltipTrigger>
            <Image
              src={getRoadIcon(roadType)}
              alt={roadType ?? ""}
              width={32}
              height={32}
              className="pt-1 px-1"
            />
          </TooltipTrigger>

          <TooltipContent anchor={{ type: "dom", ref: divRef }}>
            {roadType ?? "No road built here"}
          </TooltipContent>
        </Tooltip>
      </p>

      <ButtonWithTooltip
        disabled={!upgradeType}
        tooltip={
          upgradeType
            ? "Upgrade road to " + upgradeType
            : "Cannot upgrade road further"
        }
        onClick={() => gameStateController.changeRoadType(roadKey, upgradeType)}
      >
        <FaAnglesUp color="white" size={12}></FaAnglesUp>
      </ButtonWithTooltip>
    </div>
  );
}
