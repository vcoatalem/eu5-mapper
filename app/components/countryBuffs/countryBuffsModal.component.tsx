import { AppContext } from "@/app/appContextProvider";
import { CountryStats } from "@/app/components/countryStatsComponent";
import { gameStateController } from "@/app/lib/gameState.controller";
import { IProximityBuffDisplayableData, IProximityBuffs } from "@/app/lib/types/proximityComputationRules";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import buttonStyles from "@/app/styles/button.module.css";
import { ICountryModifierTemplate } from "@/app/lib/types/general";
import { CountryProximityBuffs } from "@/app/components/countryBuffs/countryProximityBuffs.component";
import { FaCheckSquare } from "react-icons/fa";
import { FaArrowUp, FaPlus, FaSquare } from "react-icons/fa6";
import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { FiDelete } from "react-icons/fi";
import { FoldableMenu } from "@/app/components/foldableMenu.component";
import { CountryValuesInput } from "@/app/components/countryValuesInput.component";
import { EditableField } from "@/app/components/editableField.component";
import { validateFloatInRange, validateNonEmptyString } from "@/app/lib/utils/editableFieldValidation.helper";
import { countryProximityBuffsDisplayableData } from "@/app/lib/classes/countryProximityBuffs.const";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import { TooltipTrigger } from "@/app/lib/tooltip/tooltipTrigger.component";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { BuffDisplay } from "@/app/components/countryBuffs/buffDisplay.component";
import formStyles from "@/app/components/countryBuffs/forms.module.css";

interface ICountryBuffsModal {
  onClose: () => void;
}

interface ICreateCustomModifierForm {
  onSubmit: (name: string, description: string | null, buff: Partial<IProximityBuffs>) => void;
  onCancel: () => void;
}


interface IBasicBuffFieldProps {
  buff: number;
  buffKey: keyof IProximityBuffs;
  buffDisplayableData: IProximityBuffDisplayableData;
  setBuff: (value: number) => void;
}

function BasicBuffField(props: IBasicBuffFieldProps) {
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
              <span dangerouslySetInnerHTML={{ __html: props.buffDisplayableData.description }} />
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

function CreateCustomModifierForm(props: ICreateCustomModifierForm) {

  const [name, setName] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [buff, setBuff] = useState<Partial<IProximityBuffs>>({});

  const allBuffFields = Object.entries(countryProximityBuffsDisplayableData).map(([buffKeyStr, buffDisplayableData]) => {
    const buffKey = buffKeyStr as keyof IProximityBuffs;
    return <BasicBuffField key={buffKey} buff={buff[buffKey] ?? 0} buffKey={buffKey} buffDisplayableData={buffDisplayableData} setBuff={(value) => setBuff((prev) => ({ ...prev, [buffKey]: value }))} />
  });

  return (
    <div className="flex flex-col h-full min-h-0 gap-2 relative border-white border-1 px-2 py-1">
      <div className="flex flex-row-reverse items-center gap-2 flex-none">
        <button className={[buttonStyles.simpleButton, ""].join(" ")} disabled={!name} onClick={() => props.onSubmit(name, description, buff)}>Submit
        </button>
        <button className={[buttonStyles.simpleButton, ""].join(" ")} onClick={props.onCancel}>Cancel</button>
        <h1 className="text-xl mr-auto"><b>Create New Modifier</b></h1>
      </div>
      <hr className="w-full border-stone-600 border-b-1 flex-none my-2" />
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-none">
      <div className={`sticky top-0 z-10 bg-stone-900 ${formStyles.formRow}`}>
        <label className={formStyles.formLabel}><b>Name:</b></label>
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
        <label className={formStyles.formLabel}><b>Description</b></label>
        <div className={formStyles.formValue}>
          <EditableField<string>
            value={description ?? ""}
            baseValue=""
            placeholder="Enter description"
            onValidate={(description) => setDescription(description.toString())}
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
interface IModifierItemProps {
  template: ICountryModifierTemplate;
  onHover: (template: ICountryModifierTemplate | null) => void;
  isSelected?: boolean;
  onSelect?: (template: ICountryModifierTemplate | null) => void;
  preventSelect?: boolean;
  isEnabled?: boolean | null;
  onDelete?: (template: ICountryModifierTemplate) => void;
}

function ModifierItem({ template, onHover, isSelected, onSelect, isEnabled = null, onDelete }: IModifierItemProps) {

  const divRef = useRef<HTMLDivElement>(null);

  const onEnter = useCallback(() => {
    onHover(template);
  }, [onHover, template]);

  const onLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);

  useEffect(() => {
    const el = divRef.current;
    if (el) {
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
    }
    return () => {
      if (el) {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      }
    };
  }, [onEnter, onLeave]);

  return <div ref={divRef} className={[
    "group",
    "flex flex-row items-center gap-1 rounded-md p-1 h-8",
    isSelected ? "bg-stone-700 hover:bg-stone-700/50" : "hover:bg-stone-700/50",
    onSelect && "cursor-pointer"
  ].join(" ")}
    onClick={() => onSelect && (!isSelected ? onSelect(template) : onSelect(null))}>
    {
      isEnabled !== null && (
        isEnabled ? (
          <FaCheckSquare size={16} color="white" />
        ) : (
          <FaSquare size={16} color="gray" />
        )
      )}
    <span>{template.name}</span>
    {onDelete && (
      <ButtonWithTooltip
        showOnHover={true}
        className="ml-auto"
        tooltip="Remove this modifier"
        onClick={(e) => {
          if (e) {
            e.stopPropagation();
            e.preventDefault();
          }
          onDelete(template);
        }}
      >
        <FiDelete size={16} color="white" />
      </ButtonWithTooltip>
    )}
  </div>
}

export function CountryBuffsModal(props: ICountryBuffsModal) {
  const { gameData } = useContext(AppContext);
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const [countryModifiersOpen, setCountryModifiersOpen] = useState(false);
  const [countryValuesOpen, setCountryValuesOpen] = useState(false);
  const [selectedModifier, setSelectedModifier] = useState<ICountryModifierTemplate | null>(null);
  const [hoveredModifier, setHoveredModifier] = useState<ICountryModifierTemplate | null>(null);
  const [createCustomModifierFormOpen, setCreateCustomModifierFormOpen] = useState(false);

  const addModifier = useCallback((name: string, description: string | null, buff: Partial<IProximityBuffs>) => {
    if (!gameState.country) {
      return;
    }
    gameStateController.changeCountryModifier(name, { description: description ?? "", buff: buff as IProximityBuffs, enabled: true });
    queueMicrotask(() => {
      setCountryModifiersOpen(true);
      setSelectedModifier(null);
    });
  }, [gameState]);

  const removeBuff = useCallback((name: string) => {
    if (!gameState.country) {
      return;
    }
    gameStateController.removeCountryModifier(name);
  }, [gameState]);

  const toggleBuff = useCallback((name: string) => {
    if (!gameState.country) {
      return;
    }
    if (gameState.country?.modifiers[name]?.enabled) {
      gameStateController.changeCountryModifier(name, { enabled: false });
    } else {
      gameStateController.changeCountryModifier(name, { enabled: true });
    }
  }, [gameState]);


  const createAndSelectCustomModifier = useCallback((name: string, description: string | null, buff: Partial<IProximityBuffs>) => {
    if (!gameData) {
      return;
    }
    const template: ICountryModifierTemplate = { name, description: description ?? "", buff: buff };
    gameStateController.changeCountryModifier(name, { description: description ?? "", buff: buff, enabled: true });
    queueMicrotask(() => setHoveredModifier({ name, description: description ?? "", buff: buff }));
    queueMicrotask(() => setCreateCustomModifierFormOpen(false));
  }, [gameState, gameData, setSelectedModifier, setCreateCustomModifierFormOpen]);

  const enterCreateCustomModifierForm = useCallback(() => {
    queueMicrotask(() => setSelectedModifier(null));
    queueMicrotask(() => setHoveredModifier(null));
    setCreateCustomModifierFormOpen(true);
  }, []);

  const showcasedModifier = selectedModifier ?? hoveredModifier;
  const selectedIsAlreadyInCountry = useMemo(() => Object.keys(gameState.country?.modifiers ?? {}).includes(selectedModifier?.name ?? ""), [gameState.country?.modifiers, selectedModifier?.name]);

/*   console.log(gameData?.countryModifiersTemplate);
  console.log({ modifiers: gameState.country?.modifiers }); */

  if (!gameData || !gameState.country) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-[85vw] h-[80vh] flex flex-col">

      {/* HEADER */}
      <div className="h-12 w-full flex flex-row items-center flex-0">
        <h1 className="flex-1"><b>Country Buffs</b></h1>
        <CountryStats className="ml-auto flex-1" ownedLocations={gameState.ownedLocations}></CountryStats>
        <button className={["ml-auto flex-0", buttonStyles.simpleButton].join(" ")} onClick={() => props.onClose()}>Close</button>
      </div>

      <hr className="w-full border-stone-600 border-b-1 flex-0 my-2"></hr>

      {/* BODY */}
      <div className="flex flex-row items-center align-stretch h-full">
        {/* LEFT SIDE: LIST OF BUFFS FOR THE COUNTRY + TEMPLATE LIBRARY */}
        <div className="w-[45%] h-full border-stone-600 border-r-1 p-2 flex flex-col gap-2">
          {/* COUNTRY MODIFIERS */}
          <div className="flex flex-col h-[50%] gap-2 border-stone-600 border-1 overflow-y-scroll">
            <FoldableMenu
              title={<><b>Country Modifiers</b> ({Object.entries(gameState.country?.modifiers ?? {}).length})</>}
              isExpanded={countryModifiersOpen}
              onToggle={() => setCountryModifiersOpen(!countryModifiersOpen)}
            >
              <div className="flex flex-col gap-2 px-2 overflow-x-hidden">
                {Object.entries(gameState.country?.modifiers ?? {}).map(([name, { buff, enabled }]) => {
                  return <ModifierItem key={name}
                    template={{ name, description: null, buff }}
                    onHover={(modifier) => { setHoveredModifier(modifier) }}
                    isSelected={enabled}
                    isEnabled={enabled}
                    onSelect={() => toggleBuff(name)}
                    onDelete={() => removeBuff(name)}
                  />
                })}
              </div>

            </FoldableMenu>

            <FoldableMenu
              title={<><b>Country Values</b></>}
              isExpanded={countryValuesOpen}
              onToggle={() => setCountryValuesOpen(!countryValuesOpen)}
            >
              <CountryValuesInput country={gameState.country}></CountryValuesInput>
            </FoldableMenu>

          </div>


          {/* BUFF TEMPLATES */}
          <div className="relative flex flex-col max-h-[50%] flex-1 border-stone-600 border-1 p-2 overflox-y-scroll overflow-x-hidden">
            <div className="flex flex-row-reverse items-center gap-2">

              <ButtonWithTooltip
                tooltip={selectedModifier ? (selectedIsAlreadyInCountry ? "This modifier is already in country" : "Add modifier") : "Select a modifier to add it"}
                disabled={!selectedModifier || Object.keys(gameState.country?.modifiers ?? {}).includes(selectedModifier.name)}
                onClick={() => selectedModifier && addModifier(selectedModifier.name, selectedModifier.description, selectedModifier.buff) && setSelectedModifier(null)}
              >
                <FaArrowUp size={16} color="white"></FaArrowUp>
              </ButtonWithTooltip>

              <ButtonWithTooltip disabled={createCustomModifierFormOpen} className="ml-auto" tooltip="Create new modifier" onClick={enterCreateCustomModifierForm}>
                <FaPlus size={16} color="white" />
              </ButtonWithTooltip>

              <h2 className="mr-auto"><b>Template Library</b></h2>
            </div>

            <hr className="w-full border-stone-600 border-b-1 flex-0 my-2"></hr>
            {Object.entries(gameData.countryModifiersTemplate).map(([, template]) => {
              return <ModifierItem
                key={template.name}
                template={template}
                onHover={setHoveredModifier}
                onSelect={setSelectedModifier}
                isSelected={selectedModifier?.name === template.name}
              />
            })}
          </div>
        </div>
        {/* RIGHT SIDE: DETAILS OF THE SELECTED BUFF + BUFF TEMPLATES */}
        <div className="w-[55%] h-full min-h-0 p-2 flex flex-col">

          {/* SELECTED BUFF DETAILS + CREATE NEW MODIFIER FORM */}
          <div
            className={`flex flex-col min-h-0 border-stone-600 border-1 p-2 overflow-hidden ${createCustomModifierFormOpen ? "flex-1" : "flex-[0_0_50%]"}`}
          >
            {
              (createCustomModifierFormOpen && (
                <CreateCustomModifierForm onCancel={() => setCreateCustomModifierFormOpen(false)} onSubmit={(name, description, buff) => createAndSelectCustomModifier(name, description, buff)} />
              )) || (
                showcasedModifier && (
                  <>
                    <h1 className="text-xl"><b>{showcasedModifier.name}</b></h1>
                    {showcasedModifier.description != null && (
                      <p className="text-stone-400 text-sm">{showcasedModifier.description}</p>
                    )}
                    {showcasedModifier.buff && Object.entries(showcasedModifier.buff).map(([buffKeyStr, buffData]) => {
                      const buffKey = buffKeyStr as keyof IProximityBuffs;
                      if (!buffKey) return;
                      return <BuffDisplay key={buffKey} buffKey={buffKey} buffValue={buffData} />
                    }
                    )}
                  </>
                )) || <></>
            }
          </div>
          {/* COUNTRY BUFFS BREAKDOWN - hidden when creating a new modifier */}
          {!createCustomModifierFormOpen && (
            <div className="flex-1 min-h-0 border-stone-600 border-1 p-2 flex flex-col overflow-hidden">
              <h1><b>Country Buffs Breakdown</b></h1>
              <hr className="w-full border-stone-600 border-b-1 flex-0 my-2"></hr>
              <CountryProximityBuffs country={gameState.country}></CountryProximityBuffs>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}