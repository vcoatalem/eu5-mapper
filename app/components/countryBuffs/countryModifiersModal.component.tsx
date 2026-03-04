import { AppContext } from "@/app/appContextProvider";
import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { BuffDisplay } from "@/app/components/countryBuffs/buffDisplay.component";
import { CountryProximityBuffs } from "@/app/components/countryBuffs/countryProximityBuffs.component";
import { CreateCustomModifierForm } from "@/app/components/countryBuffs/createCustomModifierForm.component";
import { CountryStats } from "@/app/components/countryStatsComponent";
import { CountryValuesInput } from "@/app/components/countryValuesInput.component";
import { FoldableMenu } from "@/app/components/foldableMenu.component";
import { Loader } from "@/app/components/loader.component";
import { countryModifiersTemplatesController } from "@/app/lib/countryModifiers.controller";
import { gameStateController } from "@/app/lib/gameState.controller";
import buttonStyles from "@/app/styles/button.module.css";
import { useParams } from "next/navigation";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FaCheckSquare } from "react-icons/fa";
import { FaArrowUp, FaPlus, FaSquare } from "react-icons/fa6";
import { FiDelete } from "react-icons/fi";
import posthog from "posthog-js";
import { ObjectHelper } from "@/app/lib/object.helper";
import { ICountryModifierTemplate } from "@/app/lib/types/countryModifiers";
import { ICountryProximityBuffs } from "@/app/lib/types/countryProximityBuffs";

interface ICountryModifiersModal {
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
  className?: string;
}

function ModifierItem({
  template,
  onHover,
  isSelected,
  onSelect,
  isEnabled = null,
  onDelete,
  className,
}: IModifierItemProps) {
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

  return (
    <div
      ref={divRef}
      className={[
        "group",
        "flex flex-row items-center gap-1 rounded-md p-1 h-8",
        isSelected
          ? "bg-stone-700 hover:bg-stone-700/50"
          : "hover:bg-stone-700/50",
        onSelect && "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() =>
        onSelect && (!isSelected ? onSelect(template) : onSelect(null))
      }
    >
      {isEnabled !== null &&
        (isEnabled ? (
          <FaCheckSquare size={16} color="white" />
        ) : (
          <FaSquare size={16} color="gray" />
        ))}
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
  );
}

export function CountryModifiersModal(props: ICountryModifiersModal) {
  const { gameData } = useContext(AppContext);
  const gameState = useSyncExternalStore(
    gameStateController.subscribe.bind(gameStateController),
    () => gameStateController.getSnapshot(),
  );

  const countryModifierTemplates = useSyncExternalStore(
    countryModifiersTemplatesController.subscribe.bind(
      countryModifiersTemplatesController,
    ),
    () => countryModifiersTemplatesController.getSnapshot(),
  );

  const [countryModifiersOpen, setCountryModifiersOpen] = useState(false);
  const [countryValuesOpen, setCountryValuesOpen] = useState(false);
  const [selectedModifier, setSelectedModifier] =
    useState<ICountryModifierTemplate | null>(null);
  const [hoveredModifier, setHoveredModifier] =
    useState<ICountryModifierTemplate | null>(null);
  const [createCustomModifierFormOpen, setCreateCustomModifierFormOpen] =
    useState(false);

  const version = useParams().version as string;

  useEffect(() => {
    if (!version) {
      throw new Error("[CreateCustomModifierForm] version not found");
    }
    countryModifiersTemplatesController.init(version);
    if (Object.keys(gameState.country?.modifiers ?? {}).length > 0) {
      queueMicrotask(() => setCountryModifiersOpen(true));
    }
  }, [version]);

  const addModifier = useCallback(
    (
      name: string,
      description: string | null,
      buff: Partial<ICountryProximityBuffs>,
    ) => {
      if (!gameState.country) {
        return;
      }
      gameStateController.changeCountryModifier(name, {
        description: description ?? "",
        buff,
        enabled: true,
      });
      queueMicrotask(() => {
        setCountryModifiersOpen(true);
        setSelectedModifier(null);
      });
    },
    [gameState],
  );

  const removeBuff = useCallback(
    (name: string) => {
      if (!gameState.country) {
        return;
      }
      gameStateController.removeCountryModifier(name);
    },
    [gameState],
  );

  const toggleBuff = useCallback(
    (name: string) => {
      if (!gameState.country) {
        return;
      }
      if (gameState.country?.modifiers[name]?.enabled) {
        gameStateController.changeCountryModifier(name, { enabled: false });
      } else {
        gameStateController.changeCountryModifier(name, { enabled: true });
      }
    },
    [gameState],
  );

  const createAndSelectCustomModifier = useCallback(
    (
      name: string,
      description: string | null,
      buff: Partial<ICountryProximityBuffs>,
    ) => {
      if (!gameData) {
        return;
      }
      const buffWithAllKeys: ICountryProximityBuffs = {
        genericModifier: buff.genericModifier ?? 0,
        landModifier: buff.landModifier ?? 0,
        seaWithMaritimeFlatCostReduction:
          buff.seaWithMaritimeFlatCostReduction ?? 0,
        seaWithoutMaritimeFlatCostReduction:
          buff.seaWithoutMaritimeFlatCostReduction ?? 0,
        portFlatCostReduction: buff.portFlatCostReduction ?? 0,
        mountainsMultiplier: buff.mountainsMultiplier ?? 0,
        plateauMultiplier: buff.plateauMultiplier ?? 0,
        hillsMultiplier: buff.hillsMultiplier ?? 0,
      };
      const template: ICountryModifierTemplate = {
        name,
        description: description ?? "",
        buff: buffWithAllKeys,
      };
      posthog.capture("custom_modifier_created", { name, description, buff });
      countryModifiersTemplatesController.addModifierTemplate(template);
      gameStateController.changeCountryModifier(name, {
        description: description ?? "",
        buff: buff,
        enabled: true,
      });
      queueMicrotask(() =>
        setHoveredModifier({
          name,
          description: description ?? "",
          buff: buffWithAllKeys,
        }),
      );
      queueMicrotask(() => setCreateCustomModifierFormOpen(false));
      queueMicrotask(() => setCountryModifiersOpen(true));
    },
    [
      gameData,
      setCreateCustomModifierFormOpen,
      setCountryModifiersOpen,
      setHoveredModifier,
    ],
  );

  const enterCreateCustomModifierForm = useCallback(() => {
    queueMicrotask(() => setSelectedModifier(null));
    queueMicrotask(() => setHoveredModifier(null));
    setCreateCustomModifierFormOpen(true);
  }, []);

  const showcasedModifier = selectedModifier ?? hoveredModifier;
  const selectedIsAlreadyInCountry = useMemo(
    () =>
      Object.keys(gameState.country?.modifiers ?? {}).includes(
        selectedModifier?.name ?? "",
      ),
    [gameState.country?.modifiers, selectedModifier?.name],
  );
  const countryModifiersCount = useMemo(
    () => Object.entries(gameState.country?.modifiers ?? {}).length,
    [gameState.country?.modifiers],
  );

  if (!gameData || !gameState.country) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-[85vw] h-[80vh] flex flex-col">
      {/* HEADER */}
      <div className="h-12 w-full flex flex-row items-center flex-0">
        <div className="flex flex-col flex-1 text-left">
          <h1 className="flex-1">
            <b>Country Modifiers</b>
          </h1>
          <span className="text-stone-400 text-sm text-left">
            Advances and other modifiers affecting proximity calculations
          </span>
        </div>
        <CountryStats
          className="ml-auto mr-2"
          ownedLocations={gameState.ownedLocations}
        ></CountryStats>
        <button
          className={["ml-auto flex-0", buttonStyles.simpleButton].join(" ")}
          onClick={() => props.onClose()}
        >
          Close
        </button>
      </div>

      <hr className="w-full border-stone-600 border-b-1 flex-0 my-2"></hr>

      {/* BODY */}
      <div className="flex flex-row items-stretch flex-1 min-h-0 overflow-hidden">
        {/* LEFT SIDE: LIST OF BUFFS FOR THE COUNTRY + TEMPLATE LIBRARY */}
        <div className="w-[45%] h-full min-h-0 border-stone-600 border-r-1 p-2 flex flex-col gap-2 shrink-0">
          {/* COUNTRY MODIFIERS */}
          <div className="flex flex-col h-[50%] gap-2 border-stone-600 border-1 overflow-y-scroll">
            <FoldableMenu
              title={
                <>
                  <b>Country Modifiers</b> ({countryModifiersCount})
                </>
              }
              disabled={countryModifiersCount === 0}
              isExpanded={countryModifiersOpen}
              onToggle={() => setCountryModifiersOpen(!countryModifiersOpen)}
            >
              <div className="flex flex-col gap-2 px-2 overflow-x-hidden">
                {Object.entries(gameState.country?.modifiers ?? {}).map(
                  ([name, { buff, enabled }]) => {
                    return (
                      <ModifierItem
                        key={name}
                        template={{ name, description: null, buff }}
                        onHover={(modifier) => {
                          setHoveredModifier(modifier);
                        }}
                        isSelected={enabled}
                        isEnabled={enabled}
                        onSelect={() => toggleBuff(name)}
                        onDelete={() => removeBuff(name)}
                      />
                    );
                  },
                )}
              </div>
            </FoldableMenu>

            <FoldableMenu
              title={
                <>
                  <b>Country Values</b>
                </>
              }
              isExpanded={countryValuesOpen}
              onToggle={() => setCountryValuesOpen(!countryValuesOpen)}
            >
              <CountryValuesInput
                country={gameState.country}
              ></CountryValuesInput>
            </FoldableMenu>
          </div>

          {/* BUFF TEMPLATES */}
          <div className="relative flex flex-col max-h-[50%] flex-1 border-stone-600 border-1 overflow-y-auto overflow-x-hidden overscroll-none">
            {countryModifierTemplates.isLoadingCountryModifiersTemplate ? (
              <div className="flex flex-col items-center justify-center flex-1">
                <Loader size={52} />
              </div>
            ) : (
              <div className="flex flex-row-reverse items-center gap-2 sticky top-0 left-0 right-0 z-10 bg-black border-stone-600 border-b-1">
                <ButtonWithTooltip
                  tooltip={
                    selectedModifier
                      ? selectedIsAlreadyInCountry
                        ? "This modifier is already in country"
                        : "Add modifier"
                      : "Select a modifier to add it"
                  }
                  disabled={
                    !selectedModifier ||
                    Object.keys(gameState.country?.modifiers ?? {}).includes(
                      selectedModifier.name,
                    )
                  }
                  onClick={() =>
                    selectedModifier &&
                    addModifier(
                      selectedModifier.name,
                      selectedModifier.description,
                      selectedModifier.buff,
                    ) &&
                    setSelectedModifier(null)
                  }
                >
                  <FaArrowUp size={16} color="white"></FaArrowUp>
                </ButtonWithTooltip>

                <ButtonWithTooltip
                  disabled={createCustomModifierFormOpen}
                  className="ml-auto"
                  tooltip="Create new modifier"
                  onClick={enterCreateCustomModifierForm}
                >
                  <FaPlus size={16} color="white" />
                </ButtonWithTooltip>

                <h2 className="mr-auto px-2 py-1">
                  <b>Template Library</b>
                </h2>
              </div>
            )}

            {countryModifierTemplates.countryModifiersTemplates &&
              Object.entries(
                countryModifierTemplates.countryModifiersTemplates,
              ).map(([, template]) => {
                return (
                  <ModifierItem
                    key={template.name}
                    template={template}
                    onHover={setHoveredModifier}
                    onSelect={setSelectedModifier}
                    isSelected={selectedModifier?.name === template.name}
                    className={"px-2 mx-1"}
                  />
                );
              })}
          </div>
        </div>
        {/* RIGHT SIDE: DETAILS OF THE SELECTED BUFF + BUFF TEMPLATES */}
        <div className="w-[55%] h-full min-h-0 min-w-0 p-2 flex flex-col">
          {/* SELECTED BUFF DETAILS + CREATE NEW MODIFIER FORM */}
          <div
            className={`flex flex-col min-h-0 min-w-0 border-stone-600 border-1 p-2 overflow-hidden shrink ${createCustomModifierFormOpen ? "flex-1" : "flex-[0_0_50%]"}`}
          >
            {(createCustomModifierFormOpen && (
              <CreateCustomModifierForm
                onCancel={() => setCreateCustomModifierFormOpen(false)}
                onSubmit={(name, description, buff) =>
                  createAndSelectCustomModifier(name, description, buff)
                }
              />
            )) ||
              (showcasedModifier && (
                <>
                  <h1 className="text-xl">
                    <b>{showcasedModifier.name}</b>
                  </h1>
                  {showcasedModifier.description != null && (
                    <p className="text-stone-400 text-sm">
                      {showcasedModifier.description}
                    </p>
                  )}
                  <hr className="w-full border-stone-600 border-b-1 flex-0 my-2"></hr>
                  {showcasedModifier.buff &&
                    ObjectHelper.getTypedEntries(showcasedModifier.buff).map(
                      ([buffKey, buffData]) => {
                        return (
                          <BuffDisplay
                            key={buffKey}
                            buffKey={buffKey}
                            buffValue={buffData}
                          />
                        );
                      },
                    )}
                </>
              )) || <></>}
          </div>
          {/* COUNTRY BUFFS BREAKDOWN - hidden when creating a new modifier */}
          {!createCustomModifierFormOpen && (
            <div className="flex-1 min-h-0 border-stone-600 border-1 p-2 flex flex-col overflow-hidden">
              <h1>
                <b>Country Buffs Breakdown</b>
              </h1>
              <hr className="w-full border-stone-600 border-b-1 flex-0 my-2"></hr>
              <CountryProximityBuffs
                country={gameState.country}
              ></CountryProximityBuffs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
