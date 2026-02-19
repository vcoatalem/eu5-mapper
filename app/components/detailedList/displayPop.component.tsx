import { ILocationDetailedViewData } from "@/app/components/detailedList/detailedLocationListModal.component";
import { EditableField } from "@/app/components/editableField.component";
import { ColorHelper } from "@/app/lib/drawing/color.helper";
import { gameStateController } from "@/app/lib/gameState.controller";
import { NumbersHelper } from "@/app/lib/utils/numbers.helper";

export function DisplayPop(props: { data: ILocationDetailedViewData }) {
  const { pop, basePop } = {
    pop:
      props.data.temporaryLocationData.population ??
      props.data.baseLocationGameData.population ??
      0,
    basePop: props.data.baseLocationGameData.population ?? 0,
  };
  const isModified = basePop !== pop;
  const baseIsLower = basePop < pop;
  return (
    <div className="px-2 py-1 group w-full h-full flex flex-row items-center relative">
      <EditableField<number>
        value={pop}
        baseValue={basePop}
        onValidate={(value) => {
          if (value > 0) {
            gameStateController.changeTemporaryLocationData(
              props.data.baseLocationGameData.name,
              { population: value },
            );
          }
        }}
        tooltip={
          <div className="flex flex-col items-start">
            <p>
              Population in that location:{" "}
              <span className="font-bold">{pop}</span>
            </p>
            <p>Click to edit</p>
          </div>
        }
      >
        <span
          style={{
            color: isModified
              ? ColorHelper.rgbToHex(
                ...ColorHelper.getEvaluationColor(baseIsLower ? 70 : 30),
              )
              : "white",
          }}
        >
          {NumbersHelper.formatWithSymbol(pop)}
        </span>
      </EditableField>
    </div>
  );
}
