import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { EditableField } from "@/app/components/editableField.component";
import { ColorHelper } from "@/app/lib/drawing/color.helper";
import { gameStateController } from "@/app/lib/gameState.controller";
import { validateFloatInRange } from "@/app/lib/utils/editableFieldValidation.helper";
import { useMemo } from "react";

export function DisplayDevelopment(props: { data: ILocationDetailedViewData }) {
  const { dev, isModified, isHigher } = useMemo(() => {
    const baseDev = props.data.baseLocationGameData.development ?? 0;
    const tempDev = props.data.temporaryLocationData.development;
    const isModified = tempDev !== undefined && tempDev !== baseDev;
    const isHigher = tempDev !== undefined && tempDev > baseDev;
    return {
      isHigher,
      dev: tempDev ?? baseDev,
      isModified,
    };
  }, [
    props.data.baseLocationGameData.development,
    props.data.temporaryLocationData.development,
  ]);
  return (
    <div className="pr-2 py-1 group w-full h-full flex flex-row items-center relative">
      <EditableField<number>
        className="w-full"
        value={dev}
        baseValue={props.data.baseLocationGameData.development ?? 0}
        validate={(raw) => validateFloatInRange(raw, -100, 100)}
        onValidate={(value) => {
          gameStateController.changeTemporaryLocationData(
            props.data.baseLocationGameData.name,
            { development: value },
          );
        }}
        tooltip={<span>Edit development</span>}
      >
        <span
          style={{
            color: isModified
              ? ColorHelper.rgbToHex(
                ...ColorHelper.getEvaluationColor(isHigher ? 30 : 70),
              )
              : "white",
          }}
        >
          {dev}
        </span>
      </EditableField>
    </div>
  );
}
