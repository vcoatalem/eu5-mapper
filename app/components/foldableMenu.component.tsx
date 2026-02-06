import React from "react";

export interface FoldableMenuProps {
  title: string | React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function FoldableMenu({ title, isExpanded, onToggle, children }: FoldableMenuProps) {
  return (
    <>
      <div className="flex-shrink-0">
        <span 
          onClick={onToggle} 
          className="font-bold hover:bg-stone-600 rounded-md py-1 cursor-pointer flex items-center gap-2 truncate ... ellipsis"
        >
          <span 
            className={`inline-block transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
          {title}
        </span>
      </div>
      <div 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded 
            ? 'max-h-[1000px] opacity-100 overflow-y-auto overflow-x-hidden' 
            : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        {children}
      </div>
    </>
  );
}
