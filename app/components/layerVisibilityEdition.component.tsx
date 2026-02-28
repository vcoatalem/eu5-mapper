import {
  getLayerVisibilityClass,
  layerVisibilityController,
} from "@/app/lib/layerVisibility.controller";
import { ObjectHelper } from "@/app/lib/object.helper";
import { Popover } from "@/app/lib/popover/popover.component";
import stylesButton from "@/app/styles/button.module.css";
import { useMemo, useSyncExternalStore } from "react";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa6";

interface ILayerVisibilityEditionProps {
  className?: string;
}

export function LayerVisibilityEdition({
  className,
}: ILayerVisibilityEditionProps) {
  const layerVisibilityState = useSyncExternalStore(
    layerVisibilityController.subscribe.bind(layerVisibilityController),
    () => layerVisibilityController.getSnapshot(),
  );

  const someLayersHidden = useMemo(() => {
    return Object.values(layerVisibilityState.layerVisibility).some(
      ({ set }) => set === "hidden",
    );
  }, [layerVisibilityState]);

  return (
    <Popover
      placement="top"
      renderTrigger={({ isOpen, toggle }) => (
        <>
          <button
            className={[
              className,
              stylesButton.iconButton,
              isOpen ? stylesButton.buttonActive : "",
              someLayersHidden ? stylesButton.buttonPartialActive : "",
            ].join(" ")}
            onClick={toggle}
          >
            <FaRegEyeSlash color="white" size={22} />
          </button>
        </>
      )}
    >
      <div className="flex flex-col gap-2">
        {ObjectHelper.getTypedEntries(layerVisibilityState.layerVisibility).map(
          ([layerName, visibility]) => (
            <button
              disabled={
                layerVisibilityState.layerVisibility[layerName]?.forced !==
                undefined
              }
              key={layerName}
              className=" flex items-center gap-2 cursor-pointer hover:bg-stone-600 rounded-md disabled:bg-blue-500/20 disabled:text-stone-400"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                layerVisibilityController.toggleLayerVisibility(layerName);
              }}
            >
              {getLayerVisibilityClass(layerName, layerVisibilityState) ===
              "visible" ? (
                <FaRegEye color="white" size={16} />
              ) : (
                <FaRegEyeSlash color="white" size={16} />
              )}
              <span className="text-sm">{layerName}</span>
            </button>
          ),
        )}
      </div>
    </Popover>
  );
}
