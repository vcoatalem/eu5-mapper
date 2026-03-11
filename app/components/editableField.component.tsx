import type { ValidationResult } from "@/app/lib/utils/editableFieldValidation.helper";
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

export interface IEditableFieldProps<
  TValue extends { toString: () => string },
> {
  value: TValue;
  baseValue: TValue;
  onValidate: (value: TValue) => void;
  validate?: (raw: string) => ValidationResult<TValue>;
  className?: string;
  tooltip?: ReactElement;
  children: ReactElement<
    TooltipTriggerChildProps,
    string | JSXElementConstructor<unknown>
  >;
  autoFocus?: boolean;
  placeholder?: string;
}

export function EditableField<TValue extends { toString: () => string }>(
  props: IEditableFieldProps<TValue>,
) {
  const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editingRaw, setEditingRaw] = useState<string | null>(null);
  const [hasValidationError, setHasValidationError] = useState(false);
  const [isStartingEdition, setIsStartingEdition] = useState(false);

  const startEditing = useCallback(() => {
    setHasValidationError(false);
    setIsStartingEdition(true);
    setEditingRaw(props.value?.toString() ?? "");
  }, [props.value]);

  useEffect(() => {
    if (isStartingEdition) {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
      queueMicrotask(() => setIsStartingEdition(false));
    }
  }, [isStartingEdition]);

  const tryCompleteEdition = useCallback(() => {
    if (editingRaw === null) return;
    if (props.validate) {
      const result = props.validate(editingRaw);
      if (result.success) {
        setHasValidationError(false);
        setEditingRaw(null);
        props.onValidate(result.value);
      } else {
        setHasValidationError(true);
      }
    } else {
      setHasValidationError(false);
      setEditingRaw(null);
      props.onValidate(editingRaw as unknown as TValue);
    }
  }, [editingRaw, props]);

  const cancelEdition = useCallback(() => {
    setEditingRaw(null);
    setHasValidationError(false);
  }, []);

  const handleBlur = useCallback(() => {
    if (hasValidationError) {
      cancelEdition();
      return;
    }
    tryCompleteEdition();
  }, [hasValidationError, cancelEdition, tryCompleteEdition]);

  const prevAutoFocusRef = useRef(false);
  useEffect(() => {
    if (props.autoFocus && !prevAutoFocusRef.current) {
      prevAutoFocusRef.current = true;
      queueMicrotask(() => startEditing());
    } else if (!props.autoFocus) {
      prevAutoFocusRef.current = false;
    }
  }, [props.autoFocus, startEditing]);

  useEffect(() => {
    const el = divRef.current;
    if (el) {
      el.addEventListener("click", startEditing);
      el.addEventListener("focus", startEditing);
    }
    return () => {
      el?.removeEventListener("click", startEditing);
      el?.removeEventListener("focus", startEditing);
    };
  }, [startEditing]);

  const displayValue = props.value?.toString() ?? "";
  const displayBaseValue = props.baseValue?.toString() ?? "";

  return (
    <div
      className={["flex flex-row items-center gap-2 min-w-0", props.className]
        .filter(Boolean)
        .join(" ")}
    >
      <div ref={divRef} className="flex-1 min-w-0" tabIndex={1}>
        <Tooltip triggerRef={inputRef}>
          <TooltipTrigger>
            {editingRaw !== null ? (
              <input
                placeholder={props.placeholder}
                id={"editable-field-input"}
                className={[
                  "w-full min-w-0",
                  hasValidationError ? "ring-2 ring-red-500 outline-none" : "",
                ].join(" ")}
                ref={inputRef}
                type="text"
                value={editingRaw}
                onChange={(e) => {
                  setEditingRaw(e.target.value);
                  if (hasValidationError) setHasValidationError(false);
                }}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryCompleteEdition();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdition();
                  }
                }}
              />
            ) : props.placeholder &&
              (!displayValue || displayValue === displayBaseValue) ? (
              <span className="text-stone-400">{props.placeholder}</span>
            ) : (
              props.children
            )}
          </TooltipTrigger>
          {editingRaw === null && props.tooltip !== undefined && (
            <TooltipContent
              anchor={{
                type: "dom",
                ref: divRef,
              }}
            >
              {props.tooltip}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
      <div className="flex flex-shrink-0 flex-row-reverse gap-1">
        {editingRaw === null && displayValue !== displayBaseValue && (
          <ButtonWithTooltip
            isActive={false}
            showOnHover={true}
            tooltip={"Revert to base value: " + displayBaseValue}
            onClick={(e) => {
              e?.stopPropagation();
              e?.preventDefault();
              props.onValidate(props.baseValue);
            }}
          >
            <RiResetRightLine color="white" size={16}></RiResetRightLine>
          </ButtonWithTooltip>
        )}
        {editingRaw !== null && (
          <ButtonWithTooltip
            showOnHover={false}
            tooltip={"Validate changes"}
            onClick={(e) => {
              e?.stopPropagation();
              e?.preventDefault();
              tryCompleteEdition();
            }}
          >
            <FaCheck color="white" size={16}></FaCheck>
          </ButtonWithTooltip>
        )}
      </div>
    </div>
  );
}
