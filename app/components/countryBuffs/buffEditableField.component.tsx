import { ICountryProximityBuffsMetadata, ICountryProximityBuffs } from "@/app/lib/types/proximityComputationRules";
import { useRef } from "react";
import formStyles from "@/app/components/countryBuffs/forms.module.css";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { EditableField } from "@/app/components/editableField.component";
import { validateFloatInRange } from "@/app/lib/utils/editableFieldValidation.helper";

interface IBuffEditableFieldProps {
  buff: number;
  buffKey: keyof ICountryProximityBuffs;
  buffDisplayableData: ICountryProximityBuffsMetadata;
  setBuff: (value: number) => void;
}

export function IBuffEditableField(props: IBuffEditableFieldProps) {
  const labelDivRef = useRef<HTMLDivElement>(null);
  return (
    <div className={formStyles.formRow}>
      <div ref={labelDivRef} className={formStyles.formLabel}>
        <Tooltip config={{ offset: { x: -400, y: 0 }, preferredHorizontal: "left", preferredVertical: "bottom" }}>
          <TooltipTrigger>
            <label className="cursor-help rounded-md p-1"><b>{props.buffDisplayableData.label}</b></label>
          </TooltipTrigger>
          <TooltipContent anchor={{ type: "dom", ref: labelDivRef as React.RefObject<HTMLElement> }}>
            <div className="max-w-96 flex flex-row items-center">
              <span dangerouslySetInnerHTML={{ __html: props.buffDisplayableData.valueDefinition.description }} />
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className={formStyles.formValue}>
        <EditableField<number>
          value={props.buff}
          baseValue={0}
          placeholder={`0`}
          validate={(raw) => validateFloatInRange(raw, 0, 100)}
          onValidate={(value) => props.setBuff(value)}
        >
          <span>{props.buff}</span>
        </EditableField>
      </div>
    </div>
  );
}