import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { RoadKey, RoadType } from "@/app/lib/types/roads";
import { useMemo } from "react";
import { FaAnglesDown, FaAnglesUp } from "react-icons/fa6";
import buttonStyles from "@/app/styles/button.module.css";
import { gameStateController } from "@/app/lib/gameState.controller";
import { getRoadIcon } from "@/app/lib/drawing/getImages";
import Image from "next/image";

interface IRoadStepperProps {
  roadKey: RoadKey;
  roadType: RoadType | null;
  className?: string;
}

export function RoadStepper({ roadKey, roadType, className }: IRoadStepperProps) {


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
      className={["flex flex-row items-center gap-1 shrink-0 min-w-[7rem]", className].filter(Boolean).join(" ")}
    >

        <ButtonWithTooltip
          disabled={roadType === null}
          tooltip={downgradeType ? "Downgrade road to " + downgradeType : "destroy road"}
          onClick={() =>
            gameStateController.changeRoadType(roadKey, downgradeType)
          }
        >
          <FaAnglesDown color="white" size={12}></FaAnglesDown>
        </ButtonWithTooltip>

      <span
        className="inline-flex shrink-0"
        style={{ filter: roadType === null ? "grayscale(100%)" : "none" }}
      >
        <Image
          src={getRoadIcon(roadType)}
          alt={roadType ?? ""}
          width={32}
          height={32}
          className="pt-1 px-1"
        />
      </span>

          <ButtonWithTooltip
            disabled={!upgradeType}
            tooltip={upgradeType ? "Upgrade road to " + upgradeType : "Cannot upgrade road further"}
            onClick={() =>
              gameStateController.changeRoadType(roadKey, upgradeType)
            }
          >
            <FaAnglesUp color="white" size={12}></FaAnglesUp>
          </ButtonWithTooltip>
    </div>

  )
}