import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipProviderContext } from "@/app/lib/tooltip/tooltip.provider";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import styles from "@/app/styles/button.module.css";
import posthog, { DisplaySurveyType } from "posthog-js";
import { useContext, useRef } from "react";
import { PiChatCircleTextLight } from "react-icons/pi";

const FEEDBACK_SURVEY_ID =
  process.env.NEXT_PUBLIC_POSTHOG_FEEDBACK_SURVEY_ID ?? "";

export function PosthogSurveyButton({
  className,
  surveyId = FEEDBACK_SURVEY_ID,
}: {
  className?: string;
  surveyId?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const tooltipContext = useContext(TooltipProviderContext);

  const handleOpenSurvey = () => {
    if (!surveyId) return;
    posthog.displaySurvey(surveyId, {
      displayType: DisplaySurveyType.Popover,
      ignoreConditions: true,
      ignoreDelay: true,
    });
  };

  return (
    <button
      ref={buttonRef}
      className={[styles.iconButton, className].filter(Boolean).join(" ")}
      onClick={handleOpenSurvey}
      disabled={!surveyId}
    >
      {tooltipContext && (<Tooltip>
        <TooltipTrigger>
          <PiChatCircleTextLight color="white" size={24}></PiChatCircleTextLight>
        </TooltipTrigger>
        <TooltipContent anchor={{ type: "dom", ref: buttonRef }}>
          <span>open contact form</span>
        </TooltipContent>
      </Tooltip>) || <span>Reach out !</span>}
    </button>
  );
}