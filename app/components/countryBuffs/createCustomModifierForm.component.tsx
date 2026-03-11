import { useState } from "react";
import { countryBuffsMetadata } from "@/app/lib/classes/countryProximityBuffs.const";
import { IBuffEditableField } from "@/app/components/countryBuffs/buffEditableField.component";
import buttonStyles from "@/app/styles/button.module.css";
import { EditableField } from "@/app/components/editableField.component";
import formStyles from "@/app/components/countryBuffs/forms.module.css";
import { validateNonEmptyString } from "@/app/lib/utils/editableFieldValidation.helper";
import { ObjectHelper } from "@/app/lib/object.helper";
import { CountryProximityBuffs } from "@/app/lib/types/countryProximityBuffs";

interface ICreateCustomModifierForm {
  onSubmit: (
    name: string,
    description: string | null,
    buff: Partial<CountryProximityBuffs>,
  ) => void;
  onCancel: () => void;
}

export function CreateCustomModifierForm(props: ICreateCustomModifierForm) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [buff, setBuff] = useState<Partial<CountryProximityBuffs>>({});

  const allBuffFields = ObjectHelper.getTypedEntries(countryBuffsMetadata).map(
    ([buffKey, buffDisplayableData]) => {
      return (
        <IBuffEditableField
          key={buffKey}
          buff={buff[buffKey] ?? 0}
          buffKey={buffKey}
          buffDisplayableData={buffDisplayableData}
          setBuff={(value) =>
            setBuff((prev) => ({ ...prev, [buffKey]: value }))
          }
        />
      );
    },
  );

  return (
    <div className="flex flex-col h-full min-h-0 gap-2 relative border-white border-1 px-2 py-1 overflow-hidden">
      <div className="flex flex-row-reverse items-center gap-2 flex-none mt-1 shrink-0">
        <button
          className={[buttonStyles.simpleButton, ""].join(" ")}
          disabled={!name}
          onClick={() => props.onSubmit(name, description, buff)}
        >
          Submit
        </button>
        <button
          className={[buttonStyles.simpleButton, ""].join(" ")}
          onClick={props.onCancel}
        >
          Cancel
        </button>
        <h1 className="text-xl mr-auto">
          <b>Create New Modifier</b>
        </h1>
      </div>
      <hr className="w-full border-stone-600 border-b-1 flex-none mb-1 shrink-0" />
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-none shrink min-w-0">
        <div className={`sticky top-0 z-10 bg-stone-900 ${formStyles.formRow}`}>
          <label className={formStyles.formLabel}>
            <b>Name:</b>
          </label>
          <div className={formStyles.formValue}>
            <EditableField<string>
              value={name}
              baseValue=""
              placeholder="Enter name"
              validate={validateNonEmptyString}
              onValidate={(name) => setName(name.toString())}
              autoFocus={true}
            >
              <span>{name}</span>
            </EditableField>
          </div>
        </div>

        <div className={formStyles.formRow}>
          <label className={formStyles.formLabel}>
            <b>Description</b>
          </label>
          <div className={formStyles.formValue}>
            <EditableField<string>
              value={description ?? ""}
              baseValue=""
              placeholder="Enter description"
              onValidate={(description) =>
                setDescription(description.toString())
              }
            >
              <span>{description}</span>
            </EditableField>
          </div>
        </div>
        {allBuffFields}
      </div>
    </div>
  );
}
