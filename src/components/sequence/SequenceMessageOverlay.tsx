import { memo, useState, useEffect, useRef } from 'react';
import { Trash2, Spline, ArrowLeftRight } from 'lucide-react';
import type { SequenceMessageBounds } from '../../utils/sequenceSvgParser';

const MESSAGE_STYLES = [
  { id: '->>', name: 'Solid Arrow', symbol: '──>>' },
  { id: '-->>', name: 'Dashed Arrow', symbol: '┈─>>' },
  { id: '->', name: 'Solid Line', symbol: '───' },
  { id: '-->', name: 'Dashed Line', symbol: '┈──' },
  { id: '-x', name: 'Solid Cross', symbol: '──x' },
  { id: '--x', name: 'Dashed Cross', symbol: '┈─x' }
];

interface SequenceMessageOverlayProps {
  message: SequenceMessageBounds;
  fromX: number;
  toX: number;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRenameCommit: (newLabel: string) => void;
  onRenameCancel: () => void;
  onStyleChange: (newStyle: string) => void;
  onReverse: () => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent, type: 'from' | 'to') => void;
  isLight: boolean;
  zoom: number;
}

export const SequenceMessageOverlay = memo(function SequenceMessageOverlay({
  message,
  fromX,
  toX,
  isSelected,
  isEditing,
  onSelect,
  onStartRename,
  onRenameCommit,
  onRenameCancel,
  onStyleChange,
  onReverse,
  onDelete,
  onDragStart,
  isLight,
  zoom
}: SequenceMessageOverlayProps) {
  const [localLabel, setLocalLabel] = useState(message.label);
  const [prevLabel, setPrevLabel] = useState(message.label);
  const [showStylePopover, setShowStylePopover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (message.label !== prevLabel) {
    setPrevLabel(message.label);
    setLocalLabel(message.label);
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isSelected) {
      setShowStylePopover(false);
    }
  }, [isSelected]);

  const handleCommit = () => {
    onRenameCommit(localLabel.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setLocalLabel(message.label);
      onRenameCancel();
    }
  };

  const leftX = Math.min(fromX, toX);
  const rightX = Math.max(fromX, toX);
  const spanWidth = rightX - leftX || 50; // fallback to 50px for self loops

  const labelLeft = message.x - leftX;
  const labelTop = message.y - (message.lineY - 12);

  return (
    <div
      data-testid={`sequence-message-overlay-${message.lineIndex}`}
      style={{
        position: 'absolute',
        left: `${leftX}px`,
        top: `${message.lineY - 12}px`,
        width: `${spanWidth}px`,
        height: `24px`,
      }}
      className="group pointer-events-none flex items-center justify-center font-sans"
    >
      {/* Transparent pointer-events-auto line hover/click zone */}
      {!isEditing && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartRename();
          }}
          className="absolute inset-x-0 h-4 top-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer z-10"
          title="Click to select, drag ends to reroute, double-click to rename"
        />
      )}

      {/* Left Drag Handle */}
      {!isEditing && (
        <div
          data-testid={`sequence-message-drag-handle-left-${message.lineIndex}`}
          onPointerDown={(e) => onDragStart(e, fromX < toX ? 'from' : 'to')}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-auto cursor-grab active:cursor-grabbing z-20"
          title="Drag to change sender/receiver"
        >
          <div className={`grid grid-cols-2 gap-0.5 p-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
          </div>
        </div>
      )}

      {/* Right Drag Handle */}
      {!isEditing && (
        <div
          data-testid={`sequence-message-drag-handle-right-${message.lineIndex}`}
          onPointerDown={(e) => onDragStart(e, fromX < toX ? 'to' : 'from')}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-auto cursor-grab active:cursor-grabbing z-20"
          title="Drag to change sender/receiver"
        >
          <div className={`grid grid-cols-2 gap-0.5 p-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
          </div>
        </div>
      )}

      {/* Label Box / Midpoint Wrapper */}
      <div
        style={{
          position: 'absolute',
          left: `${labelLeft}px`,
          top: `${labelTop}px`,
          width: `${message.width}px`,
          height: `${message.height}px`,
        }}
        className="pointer-events-none flex items-center justify-center"
      >
        {message.hasLabel ? (
          <div
            className={`absolute inset-0 border rounded transition-all duration-200 pointer-events-none ${
              isSelected
                ? isLight
                  ? 'border-indigo-500 bg-white shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                  : 'border-indigo-500 bg-slate-900/60 shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                : isLight
                ? 'border-transparent hover:border-slate-300'
                : 'border-transparent hover:border-slate-800'
            }`}
          />
        ) : (
          <div
            className={`w-5 h-5 rounded-full border flex items-center justify-center shadow-lg transition-all duration-200 pointer-events-none ${
              isLight ? 'bg-white' : 'bg-slate-900'
            } ${
              isSelected
                ? 'border-indigo-500 scale-110 shadow-[0_0_10px_rgba(99,102,241,0.35)] opacity-100'
                : 'border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors pointer-events-none ${
                isSelected ? 'bg-indigo-400' : 'bg-slate-400'
              }`}
            />
          </div>
        )}

        {/* Inline Label input field */}
        {isEditing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto p-0.5">
            <input
              ref={inputRef}
              type="text"
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={handleKeyDown}
              placeholder="message..."
              onClick={(e) => e.stopPropagation()}
              className={`w-full h-full text-center font-semibold text-xs rounded-md border-2 shadow-md focus:outline-none transition-all overlay-interactive ${
                isLight
                  ? 'bg-white border-indigo-550 text-slate-850 placeholder-slate-400'
                  : 'bg-slate-900 border-indigo-400 text-slate-100 placeholder-slate-600'
              }`}
              style={{ minWidth: '100px', fontSize: 'inherit' }}
            />
          </div>
        )}

        {/* Message action command palette bar */}
        {isSelected && !isEditing && (
          <div
            style={{
              transform: `translateX(-50%) scale(${1 / zoom})`,
              transformOrigin: 'bottom center',
            }}
            className="absolute bottom-[calc(100%+12px)] left-1/2 flex flex-col items-center pointer-events-auto z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center gap-1 p-1 rounded-xl border shadow-xl backdrop-blur-md overlay-interactive ${
                isLight
                  ? 'bg-white/95 border-slate-200 text-slate-700'
                  : 'bg-slate-900/95 border-slate-800 text-slate-200'
              }`}
            >
              {/* Reverse command */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReverse();
                }}
                className={`p-2 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-slate-100 hover:text-slate-900' : 'hover:bg-slate-800 hover:text-slate-100'
                }`}
                title="Reverse Message Direction"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Reverse</span>
              </button>

              <div className={`w-px h-5 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

              {/* Link style command */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStylePopover(!showStylePopover);
                }}
                className={`p-2 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                  showStylePopover
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                    : isLight
                    ? 'hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                    : 'hover:bg-slate-800 hover:text-slate-100 border border-transparent'
                }`}
                title="Change Arrow Style"
              >
                <Spline className="w-4 h-4" />
                <span>Style</span>
              </button>

              <div className={`w-px h-5 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

              {/* Delete command */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className={`p-2 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                  isLight
                    ? 'hover:bg-rose-50 hover:text-rose-600'
                    : 'hover:bg-rose-950/40 hover:text-rose-400'
                }`}
                title="Delete Message"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>

            {/* Style picker sub-popover */}
            {showStylePopover && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute top-[calc(100%+8px)] flex flex-col w-52 p-2 rounded-xl border shadow-2xl backdrop-blur-md z-[60] overlay-interactive animate-in fade-in slide-in-from-top-2 ${
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
                  Arrow Style
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {MESSAGE_STYLES.map((style) => {
                    const isCurrent = message.arrow === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onStyleChange(style.id);
                          setShowStylePopover(false);
                        }}
                        title={style.name}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-[10px] font-medium transition-all cursor-pointer h-12 ${
                          isCurrent
                            ? isLight
                              ? 'bg-indigo-50 border-indigo-555 text-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                              : 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.25)]'
                            : isLight
                            ? 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                            : 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:border-slate-700/60 hover:text-slate-200'
                        }`}
                      >
                        <span className="font-mono text-sm mb-0.5 text-slate-450 select-none">
                          {style.symbol}
                        </span>
                        <span className="truncate w-full text-[9px] font-bold text-slate-500 text-center">
                          {style.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
