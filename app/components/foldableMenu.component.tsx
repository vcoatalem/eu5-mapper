import React from "react";

export interface FoldableMenuProps {
  title: string | React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function FoldableMenu({
  title,
  isExpanded,
  onToggle,
  children,
  disabled = false,
}: FoldableMenuProps) {
  return (
    <div className="shrink-0 z-10 backdrop-blur-sm">
      <button
        disabled={disabled}
        type="button"
        onClick={onToggle}
        className={[
          "w-full text-left font-bold bg-black hover:bg-stone-600 py-1 cursor-pointer flex items-center gap-2 truncate sticky top-0 z-10 px-2",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span
          className={`inline-block transition-transform duration-300 ease-in-out ${isExpanded ? "rotate-180" : ""}`}
        >
          ▼
        </span>
        {title}
      </button>
      {isExpanded && <div className="mt-1">{children}</div>}
    </div>
  );
}
