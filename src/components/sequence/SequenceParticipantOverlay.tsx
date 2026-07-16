import { memo, useState, useEffect, useRef } from 'react';
import { Trash2, Shapes } from 'lucide-react';
import type { SequenceParticipantBounds } from '../../utils/sequenceSvgParser';
import { TypePickerPopover } from '../Preview/TypePickerPopover';
import type { TypePickerItem } from '../Preview/TypePickerPopover';

// Uml Shapes SVG rendering helper
export function UmlShapePreview({ id }: { id: string }) {
  switch (id) {
    case 'participant':
      return (
        <svg viewBox="0 0 50 30" className="w-10 h-5 text-current">
          <rect x="5" y="8" width="40" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'actor':
      return (
        <svg viewBox="0 0 50 30" className="w-10 h-5 text-current">
          <circle cx="25" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="25" y1="12" x2="25" y2="22" stroke="currentColor" strokeWidth="1.5" />
          <line x1="18" y1="15" x2="32" y2="15" stroke="currentColor" strokeWidth="1.5" />
          <line x1="25" y1="22" x2="20" y2="28" stroke="currentColor" strokeWidth="1.5" />
          <line x1="25" y1="22" x2="30" y2="28" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'boundary':
      return (
        <svg viewBox="0 0 50 30" className="w-10 h-5 text-current">
          <circle cx="28" cy="15" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="12" y1="7" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" />
          <line x1="12" y1="15" x2="20" y2="15" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'control':
      return (
        <svg viewBox="0 0 50 30" className="w-10 h-5 text-current">
          <path d="M22,7 A8,8 0 1,1 17.5,18" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M19,5 L25,7 L20,12" fill="currentColor" />
        </svg>
      );
    case 'entity':
      return (
        <svg viewBox="0 0 50 30" className="w-10 h-5 text-current">
          <circle cx="25" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="15" y1="22" x2="35" y2="22" stroke="currentColor" strokeWidth="1.5" />
          <line x1="25" y1="20" x2="25" y2="22" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'collections':
      return (
        <svg viewBox="0 0 50 30" className="w-10 h-5 text-current">
          <rect x="5" y="11" width="34" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11,11 V8 H45 V20 H42" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'database':
      return (
        <svg viewBox="0 0 50 30" className="w-10 h-5 text-current">
          <ellipse cx="25" cy="8" rx="14" ry="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11,8 V22 C11,26 39,26 39,22 V8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11,15 C11,19 39,19 39,15" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'queue':
      return (
        <svg viewBox="0 0 50 30" className="w-10 h-5 text-current">
          <path d="M10,8 H40 A7,7 0 0,1 40,22 H10 A7,7 0 0,1 10,8 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M33,8 A7,7 0 0,1 33,22" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

// All UML shape type list
const PARTICIPANT_TYPES = [
  { id: 'participant', name: 'Participant' },
  { id: 'actor', name: 'Actor' },
  { id: 'boundary', name: 'Boundary' },
  { id: 'control', name: 'Control' },
  { id: 'entity', name: 'Entity' },
  { id: 'collections', name: 'Collections' },
  { id: 'database', name: 'Database' },
  { id: 'queue', name: 'Queue' }
];

const typeItems: TypePickerItem[] = PARTICIPANT_TYPES.map(type => ({
  id: type.id,
  name: type.name,
  renderPreview: () => <UmlShapePreview id={type.id} />
}));

interface SequenceParticipantOverlayProps {
  participant: SequenceParticipantBounds;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRenameCommit: (newName: string) => void;
  onRenameCancel: () => void;
  onTypeChange: (newType: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  isLight: boolean;
  zoom: number;
}

export const SequenceParticipantOverlay = memo(function SequenceParticipantOverlay({
  participant,
  isSelected,
  isEditing,
  onSelect,
  onStartRename,
  onRenameCommit,
  onRenameCancel,
  onTypeChange,
  onDelete,
  onDragStart,
  isLight,
  zoom
}: SequenceParticipantOverlayProps) {
  const [localLabel, setLocalLabel] = useState(participant.alias);
  const [prevAlias, setPrevAlias] = useState(participant.alias);
  const [showTypePopover, setShowTypePopover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (participant.alias !== prevAlias) {
    setPrevAlias(participant.alias);
    setLocalLabel(participant.alias);
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isSelected) {
      setShowTypePopover(false);
    }
  }, [isSelected]);

  const handleCommit = () => {
    if (localLabel.trim() !== '') {
      onRenameCommit(localLabel.trim());
    } else {
      setLocalLabel(participant.alias);
      onRenameCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setLocalLabel(participant.alias);
      onRenameCancel();
    }
  };

  return (
    <div
      data-testid={`sequence-participant-overlay-${participant.id}`}
      style={{
        position: 'absolute',
        left: `${participant.x}px`,
        top: `${participant.y}px`,
        width: `${participant.width}px`,
        height: `${participant.height}px`,
      }}
      className="group pointer-events-none flex items-center justify-center"
    >
      {/* Click and Double Click area */}
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
          className="absolute inset-0 pointer-events-auto cursor-pointer z-10"
          title="Click to configure, double-click to rename"
        />
      )}

      {/* Inline Label Editor */}
      {isEditing && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-transparent pointer-events-auto p-1">
          <input
            ref={inputRef}
            type="text"
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            className={`w-full h-full text-center font-semibold text-xs rounded-md border-2 shadow-md focus:outline-none transition-all ${
              isLight
                ? 'bg-white border-indigo-500 text-slate-850'
                : 'bg-slate-900 border-indigo-400 text-slate-100'
            }`}
            style={{ fontSize: 'inherit' }}
          />
        </div>
      )}

      {/* Selection Glow Border */}
      <div
        className={`absolute inset-0 border-2 rounded-lg transition-all duration-200 shadow-lg pointer-events-none ${
          isSelected && !isEditing
            ? 'border-indigo-500 shadow-[0_0_14px_rgba(99,102,241,0.45)]'
            : 'border-transparent group-hover:border-indigo-500/60 group-hover:shadow-[0_0_10px_rgba(99,102,241,0.2)]'
        }`}
      />

      {/* Drag Handle Gripper (Visible on hover only) */}
      {!isEditing && (
        <div
          data-testid={`sequence-participant-drag-handle-${participant.id}`}
          onPointerDown={onDragStart}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute left-[-16px] w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-auto cursor-grab active:cursor-grabbing z-20"
          title="Drag to reorder participant"
        >
          {/* 6 dot drag handle grip */}
          <div className={`grid grid-cols-2 gap-0.5 p-1 rounded ${isLight ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
            <div className="w-1 h-1 rounded-full bg-current" />
          </div>
        </div>
      )}

      {/* Floating Action Command Bar */}
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
            className={`flex items-center gap-1 p-1 rounded-xl border shadow-xl backdrop-blur-md ${
              isLight
                ? 'bg-white/95 border-slate-200 text-slate-700'
                : 'bg-slate-900/95 border-slate-800 text-slate-200'
            }`}
          >
            {/* Shape/Type Selector trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTypePopover(!showTypePopover);
              }}
              className={`p-2 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                showTypePopover
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                  : isLight
                  ? 'hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                  : 'hover:bg-slate-800 hover:text-slate-100 border border-transparent'
              }`}
            >
              <Shapes className="w-4 h-4" />
              <span>Type</span>
            </button>

            <div className={`w-px h-5 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

            {/* Delete button */}
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
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>

          {/* UML Shape Type selection popover */}
          {showTypePopover && (
            <TypePickerPopover
              title="Participant Type"
              items={typeItems}
              currentId={participant.type}
              onSelect={(typeId) => {
                onTypeChange(typeId);
                setShowTypePopover(false);
              }}
              isLight={isLight}
              gridColsClass="grid-cols-4"
              widthClass="w-60"
            />
          )}
        </div>
      )}
    </div>
  );
});
