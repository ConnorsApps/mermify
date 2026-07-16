import type { ReactNode } from 'react';

export interface TypePickerItem {
  id: string;
  name: string;
  renderPreview: () => ReactNode;
}

interface TypePickerPopoverProps {
  title: string;
  items: TypePickerItem[];
  currentId: string;
  onSelect: (id: string) => void;
  isLight: boolean;
  gridColsClass?: string; // e.g. "grid-cols-3" (default) or "grid-cols-4"
  widthClass?: string;    // e.g. "w-56" (default) or "w-60"
}

export function TypePickerPopover({
  title,
  items,
  currentId,
  onSelect,
  isLight,
  gridColsClass = 'grid-cols-3',
  widthClass = 'w-56',
}: TypePickerPopoverProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-[calc(100%+8px)] flex flex-col p-2 rounded-xl border shadow-2xl backdrop-blur-md z-[60] overlay-interactive animate-in fade-in slide-in-from-top-2 ${
        widthClass
      } ${
        isLight
          ? 'bg-white/95 border-slate-200 shadow-slate-200/50'
          : 'bg-slate-900/95 border-slate-800 shadow-slate-950/70'
      }`}
    >
      <div
        className={`text-[10px] font-bold tracking-wider uppercase mb-1.5 px-1.5 ${
          isLight ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        {title}
      </div>
      <div className={`grid ${gridColsClass} gap-1`}>
        {items.map((item) => {
          const isCurrent = currentId === item.id;
          return (
            <button
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item.id);
              }}
              title={item.name}
              className={`flex items-center justify-center p-1 rounded-lg border transition-all cursor-pointer h-9 ${
                isCurrent
                  ? isLight
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                    : 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.25)]'
                  : isLight
                  ? 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:border-slate-700/60 hover:text-slate-200'
              }`}
            >
              {item.renderPreview()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
