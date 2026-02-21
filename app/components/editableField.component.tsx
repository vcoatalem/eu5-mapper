import { ButtonWithTooltip } from "@/app/components/buttonWithTooltip.component";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import {
  TooltipTrigger,
  TooltipTriggerChildProps,
} from "@/app/lib/tooltip/tooltipTrigger.component";
import {
  JSXElementConstructor,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FaCheck } from "react-icons/fa6";
import { RiResetRightLine } from "react-icons/ri";

interface IEditableFieldProps<TValue> {
  onValidate: (value: TValue) => void;
  className?: string;
  tooltip: ReactElement;
  children: ReactElement<
    TooltipTriggerChildProps,
    string | JSXElementConstructor<unknown>
  >;
  value: TValue; // handle strings later
  baseValue: TValue;
  autoFocus?: boolean;
}

export function EditableField<TValue>(props: IEditableFieldProps<TValue>) {
  const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseValueRef = useRef<TValue | null>(null);
  const [isEditing, setIsEditing] = useState<TValue | null>(null);
  const [isStartingEdition, setIsStartingEdition] = useState<boolean>(false);


  console.log("[EditableField] props", props);
  const startEditing = useCallback(() => {
    console.log("[EditableField] Starting edition");
    setIsStartingEdition(true);
    setIsEditing(props.value);
  }, [props.value]);

  useEffect(() => {
    if (isStartingEdition) {
      console.log("[EditableField] Focusing input", inputRef);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
      queueMicrotask(() => setIsStartingEdition(false));
    }
  }, [isStartingEdition]);

  const completeEdition = useCallback(() => {
    console.log("[EditableField] Completing edition");
    if (isEditing !== null && isEditing !== props.value) {
      props.onValidate(isEditing);
    }
    setIsEditing(null);
    setIsStartingEdition(false);
  }, [isEditing, props]);

  const cancelEdition = useCallback(() => {
    setIsEditing(null);
    setIsStartingEdition(false);
  }, []);

  /* const prevAutoFocusRef = useRef(false); */
  useEffect(() => {
    if (props.autoFocus /* && !prevAutoFocusRef.current */) {
      /* prevAutoFocusRef.current = true; */
      console.log("[EditableField] autoFocus is true, starting edition");
      queueMicrotask(() => startEditing());
    } else if (!props.autoFocus) {
      /* prevAutoFocusRef.current = false; */
    }
  }, [props.autoFocus, startEditing]);

  useEffect(() => {
    baseValueRef.current = props.value;

    if (divRef.current) {
      /* console.log("[EditableField] registering event listeners"); */
      divRef.current.addEventListener("click", startEditing);
      divRef.current.addEventListener("focus", startEditing);
    }
    return () => {
      /* console.log("[EditableField] unregistering event listeners"); */
      divRef.current?.removeEventListener("click", startEditing);
      divRef.current?.removeEventListener("focus", startEditing);
    };
  }, []);

  return (
    <>
      <div ref={divRef} className={props.className ?? ""} tabIndex={1}>
        <Tooltip triggerRef={inputRef}>
          <TooltipTrigger>
            {isEditing !== null ? (
              <input
                id={"editable-field-input"}
                className="max-w-16"
                ref={inputRef}
                type="number"
                defaultValue={Number(isEditing)}
                onChange={(e) =>
                  setIsEditing((Number(e.target.value) ?? 0) as TValue)
                } //TODO: find proper way to handle cast
                onBlur={() => {
                  console.log("[EditableField] onBlur");
                  completeEdition();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    completeEdition();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdition();
                  }
                }}
              />
            ) : (
              props.children
            )}
          </TooltipTrigger>
          {isEditing === null && (
            <TooltipContent
              anchor={{
                type: "dom",
                ref: divRef as React.RefObject<HTMLElement>,
              }}
            >
              {props.tooltip}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-row-reverse gap-1">
        {isEditing === null && props.value !== props.baseValue && (
          <ButtonWithTooltip
            isActive={false}
            showOnHover={true}
            tooltip={"Revert to base value: " + props.baseValue}
            onClick={(e) => {
              if (e) {
                e.stopPropagation();
                e.preventDefault();
              }
              console.log("[EditableField] clicked revert button");
              props.onValidate(props.baseValue);
            }}
          >
            <RiResetRightLine color="white" size={16}></RiResetRightLine>
          </ButtonWithTooltip>
        )}
        {isEditing !== null && (
          <ButtonWithTooltip
            showOnHover={false}
            tooltip={"Validate changes"}
            onClick={(e) => {
              if (e) {
                e.stopPropagation();
                e.preventDefault();
              }
              props.onValidate(isEditing);
              inputRef.current?.blur();
            }}
          >
            <FaCheck color="white" size={16}></FaCheck>
          </ButtonWithTooltip>
        )}
      </div>
    </>
  );
}
