import React from "react";

export interface FoldableMenuProps {
  title: string | React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function FoldableMenu({
  title,
  isExpanded,
  onToggle,
  children,
}: FoldableMenuProps) {
  return (
    <div className="shrink-0 z-10 backdrop-blur-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left font-bold hover:bg-stone-600 rounded-md py-1 cursor-pointer flex items-center gap-2 truncate sticky top-0 z-10 bg-black/80"
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
