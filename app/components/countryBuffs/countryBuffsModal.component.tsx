import { AppContext } from "@/app/appContextProvider";
import { CountryStats } from "@/app/components/countryStatsComponent";
import { gameStateController } from "@/app/lib/gameState.controller";
import { IProximityBuffs } from "@/app/lib/types/proximityComputationRules";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import buttonStyles from "@/app/styles/button.module.css";
import { ICountryModifierTemplate } from "@/app/lib/types/general";
import { CountryProximityBuffs } from "@/app/components/countryBuffs/countryProximityBuffs.component";
import { FaCheckSquare } from "react-icons/fa";
import { FaSquare, FaTrash } from "react-icons/fa6";
import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { FiDelete } from "react-icons/fi";
import { FoldableMenu } from "@/app/components/foldableMenu.component";
import { CountryOverview } from "@/app/components/countryOverview.component";
import { CountryValuesInput } from "@/app/components/countryValuesInput.component";

interface ICountryBuffsModal {
  onClose: () => void;
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

  const addBuff = useCallback((name: string, description: string | null, buff: Partial<IProximityBuffs>) => {
    if (!gameState.country) {
      return;
    }
    gameStateController.changeCountryModifier(name, { description: description ?? "", buff: buff as IProximityBuffs, enabled: true });
    queueMicrotask(() => {
      setCountryModifiersOpen(true);
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

  const showcasedModifier = selectedModifier ?? hoveredModifier;
  const selectedIsAlreadyInCountry = useMemo(() => Object.keys(gameState.country?.modifiers ?? {}).includes(selectedModifier?.name ?? ""), [gameState.country?.modifiers, selectedModifier?.name]);

  console.log(gameData?.countryModifiersTemplate);
  console.log({ modifiers: gameState.country?.modifiers });

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
        <div className="w-[60%] h-full border-stone-600 border-r-1 p-2 flex flex-col gap-2">
          {/* COUNTRY MODIFIERS */}
          <div className="flex flex-col h-[50%] gap-2 border-stone-600 border-1 overflow-y-scroll">
            <FoldableMenu
              title={<><b>Country Modifiers</b> ({Object.entries(gameState.country?.modifiers ?? {}).length})</>}
              isExpanded={countryModifiersOpen}
              onToggle={() => setCountryModifiersOpen(!countryModifiersOpen)}
            >
              <div className="flex flex-col gap-2 px-2">
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
            <h2 className=""><b>Template Library</b></h2>
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

            {selectedModifier && (
              <ButtonWithTooltip
                className="absolute bottom-2 left-1/2 -translate-x-1/2"
                tooltip={selectedIsAlreadyInCountry ? "This modifier is already in country" : null}
                disabled={Object.keys(gameState.country?.modifiers ?? {}).includes(selectedModifier.name)}
                onClick={() => { addBuff(selectedModifier.name, selectedModifier.description, selectedModifier.buff); setSelectedModifier(null); }}
              >
                <span>Add {selectedModifier.name}</span>
              </ButtonWithTooltip>
            )}
          </div>
        </div>
        {/* RIGHT SIDE: DETAILS OF THE SELECTED BUFF + BUFF TEMPLATES */}
        <div className="w-[40%] h-full p-2 flex flex-col">

          {/* SELECTED BUFF DETAILS */}
          <div className="flex flex-col h-[50%] border-stone-600 border-1 p-2">
            {showcasedModifier && (
              <>
                <h1 className="text-xl"><b>{showcasedModifier.name}</b></h1>
                {showcasedModifier.description != null && (
                  <p className="text-stone-400 text-sm">{showcasedModifier.description}</p>
                )}
                {showcasedModifier.buff && Object.entries(showcasedModifier.buff).map(([buffKey, buffData]) =>
                  <span key={buffKey}>{buffKey}: {String(buffData)}</span>
                )}
              </>
            )}
          </div>
          {/* COUNTRY BUFFS BREAKDOWN */}
          <div className="flex-1 border-stone-600 border-1 p-2 h-[50%]">
            <h1><b>Country Buffs Breakdown</b></h1>
            <hr className="w-full border-stone-600 border-b-1 flex-0 my-2"></hr>
            <CountryProximityBuffs country={gameState.country}></CountryProximityBuffs>
          </div>
        </div>
      </div>

    </div>
  )
}