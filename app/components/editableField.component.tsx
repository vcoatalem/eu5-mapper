import { ContextualButton } from "@/app/components/contextualButton.component";
import { Tooltip } from "@/app/lib/tooltip/tooltip.component";
import { TooltipContent } from "@/app/lib/tooltip/tooltipContent.component";
import {
  TooltipTrigger,
  TooltipTriggerChildProps,
} from "@/app/lib/tooltip/tooltipTrigger.component";
import Image from "next/image";
import {
  forwardRef,
  JSXElementConstructor,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface IEditableFieldProps<T> {
  onValidate: (value: T) => void;
  className?: string;
  tooltip: ReactElement;
  children: ReactElement<
    TooltipTriggerChildProps,
    string | JSXElementConstructor<unknown>
  >;
  value: T; // handle strings later
  baseValue: T;
}

export function EditableField<T>(props: IEditableFieldProps<T>) {
  const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseValueRef = useRef<T | null>(null);
  const [isEditing, setIsEditing] = useState<T | null>(null);
  const [isStartingEdition, setIsStartingEdition] = useState<boolean>(false);

  const startEditing = useCallback(() => {
    console.log("[EditableField] Starting edition");
    setIsStartingEdition(true);
    setIsEditing(props.value);
  }, [props.value, inputRef.current]);

  useEffect(() => {
    if (isStartingEdition) {
      console.log("[EditableField] Focusing input", inputRef);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
      setIsStartingEdition(false);
    }
  }, [isStartingEdition]);

  const completeEdition = useCallback(() => {
    console.log("[EditableField] Completing edition");
    if (isEditing && isEditing !== props.value) {
      props.onValidate(isEditing);
    }
    setIsEditing(null);
    setIsStartingEdition(false);
  }, [isEditing, props]);

  useEffect(() => {
    baseValueRef.current = props.value;

    if (divRef.current) {
      console.log("[EditableField] registering event listeners");
      divRef.current.addEventListener("click", startEditing);
      divRef.current.addEventListener("focus", startEditing);
    }
    return () => {
      console.log("[EditableField] unregistering event listeners");
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
                  setIsEditing((Number(e.target.value) ?? 0) as T)
                } //TODO: find proper way to handle cast
                onBlur={(e) => {
                  console.log("onblur");
                  completeEdition();
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
          <ContextualButton
            isSelected={false}
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
            <Image
              src={"/icons/reset.svg"}
              width={16}
              height={16}
              alt="Revert"
            ></Image>
          </ContextualButton>
        )}
        {isEditing !== null && (
          <ContextualButton
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
            <Image
              src={"/icons/check.svg"}
              width={16}
              height={16}
              alt="Validate"
            ></Image>
          </ContextualButton>
        )}
      </div>
    </>
  );
}
