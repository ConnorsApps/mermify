import { useState, useEffect, useRef, useCallback } from 'react';
import type { SequenceParticipantBounds, SequenceMessageBounds } from '../../utils/sequenceSvgParser';
import { SequenceParticipantOverlay } from './SequenceParticipantOverlay';
import { SequenceMessageOverlay } from './SequenceMessageOverlay';
import { SequenceAddButtons } from './SequenceAddButtons';

interface SequenceCanvasProps {
  participants: SequenceParticipantBounds[];
  messages: SequenceMessageBounds[];
  onAddParticipant: (type: string, afterId?: string) => void;
  onUpdateParticipant: (id: string, alias: string, type: string) => void;
  onDeleteParticipant: (id: string) => void;
  onReorderParticipants: (newOrder: string[]) => void;
  onAddMessage: (from: string, to: string, arrow: string, label: string, afterLineIndex: number) => void;
  onUpdateMessage: (lineIndex: number, label: string, arrow: string) => void;
  onUpdateMessageConnection: (lineIndex: number, newFrom: string, newTo: string) => void;
  onReverseMessage: (lineIndex: number) => void;
  onDeleteMessage: (lineIndex: number) => void;
  isLight: boolean;
  zoom: number;
}

export function SequenceCanvas({
  participants,
  messages,
  onAddParticipant,
  onUpdateParticipant,
  onDeleteParticipant,
  onReorderParticipants,
  onAddMessage,
  onUpdateMessage,
  onUpdateMessageConnection,
  onReverseMessage,
  onDeleteMessage,
  isLight,
  zoom
}: SequenceCanvasProps) {
  // Selection and Editing states
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);

  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);

  // Drag to reorder state
  const [draggedPartId, setDraggedPartId] = useState<string | null>(null);
  const [dragTargetGap, setDragTargetGap] = useState<number | null>(null);

  const dragStartRef = useRef<{ clientX: number; partIndex: number; startX: number } | null>(null);
  const dragTargetGapRef = useRef<number | null>(null);

  // Message Drag-to-Reroute states
  const [draggedMsgLineIndex, setDraggedMsgLineIndex] = useState<number | null>(null);
  const [dragTargetPartId, setDragTargetPartId] = useState<string | null>(null);

  const dragTargetPartIdRef = useRef<string | null>(null);
  const dragMsgStartRef = useRef<{ clientX: number; startX: number } | null>(null);

  // Deselect on canvas click (outside overlays)
  useEffect(() => {
    const handleCanvasClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If clicked on an interactive overlay element, don't deselect
      if (target.closest('.overlay-interactive') || target.closest('[data-testid*="overlay"]')) {
        return;
      }
      setSelectedPartId(null);
      setEditingPartId(null);
      setSelectedLineIndex(null);
      setEditingLineIndex(null);
    };

    window.addEventListener('click', handleCanvasClickOutside);
    return () => window.removeEventListener('click', handleCanvasClickOutside);
  }, []);

  // Reorder Drag gesture handlers
  const handleDragStart = useCallback((e: React.PointerEvent, partId: string, partIndex: number) => {
    e.preventDefault();
    setSelectedPartId(null);
    setEditingPartId(null);
    
    const part = participants[partIndex];
    if (!part) return;

    setDraggedPartId(partId);
    setDragTargetGap(partIndex);
    dragTargetGapRef.current = partIndex;
    dragStartRef.current = {
      clientX: e.clientX,
      partIndex,
      startX: part.x
    };

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dX = (moveEv.clientX - dragStartRef.current.clientX) / zoom;
      const currentX = dragStartRef.current.startX + dX;

      // Find the closest insertion gap
      // Gaps exist:
      // - 0: Before first participant
      // - i (1 to m-1): Between participant i-1 and i
      // - m: After last participant
      const m = participants.length;
      let closestGap = 0;
      let minDistance = Infinity;

      // Check gap before index 0
      const gap0X = participants[0].x - 16;
      let dist = Math.abs(currentX - gap0X);
      if (dist < minDistance) {
        minDistance = dist;
        closestGap = 0;
      }

      // Check gaps in between
      for (let i = 1; i < m; i++) {
        const prev = participants[i - 1];
        const cur = participants[i];
        const gapX = (prev.x + prev.width + cur.x) / 2;
        dist = Math.abs(currentX - gapX);
        if (dist < minDistance) {
          minDistance = dist;
          closestGap = i;
        }
      }

      // Check gap after last participant
      const last = participants[m - 1];
      const gapLastX = last.x + last.width + 16;
      dist = Math.abs(currentX - gapLastX);
      if (dist < minDistance) {
        minDistance = dist;
        closestGap = m;
      }

      setDragTargetGap(closestGap);
      dragTargetGapRef.current = closestGap;
    };

    const handlePointerUp = () => {
      const targetGap = dragTargetGapRef.current;

      setDraggedPartId(null);
      setDragTargetGap(null);
      dragTargetGapRef.current = null;

      if (dragStartRef.current && targetGap !== null) {
        const fromIdx = dragStartRef.current.partIndex;
        const toIdx = targetGap;

        // If target is same or redundant gap (dropping at index i or index i+1 results in no reorder)
        if (toIdx !== fromIdx && toIdx !== fromIdx + 1) {
          const newOrder = participants.map(p => p.id);
          const [removed] = newOrder.splice(fromIdx, 1);
          // Adjust insert position if target gap was after fromIdx
          const adjustedToIdx = toIdx > fromIdx ? toIdx - 1 : toIdx;
          newOrder.splice(adjustedToIdx, 0, removed);
          onReorderParticipants(newOrder);
        }
      }

      dragStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [participants, onReorderParticipants, zoom]);

  // Message Drag gesture handlers
  const handleMsgDragStart = useCallback((
    e: React.PointerEvent,
    lineIndex: number,
    handleType: 'from' | 'to',
    startX: number
  ) => {
    e.preventDefault();
    setSelectedPartId(null);
    setEditingPartId(null);
    setSelectedLineIndex(null);
    setEditingLineIndex(null);

    setDraggedMsgLineIndex(lineIndex);
    
    // Find initial target
    const msg = messages.find(m => m.lineIndex === lineIndex);
    if (!msg) return;
    const initialTargetId = handleType === 'from' ? msg.from : msg.to;
    setDragTargetPartId(initialTargetId);
    dragTargetPartIdRef.current = initialTargetId;

    dragMsgStartRef.current = {
      clientX: e.clientX,
      startX
    };

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!dragMsgStartRef.current) return;
      const dX = (moveEv.clientX - dragMsgStartRef.current.clientX) / zoom;
      const currentX = dragMsgStartRef.current.startX + dX;

      // Find the closest participant lifeline X
      let closestPart = participants[0];
      let minDistance = Infinity;
      participants.forEach(p => {
        const dist = Math.abs(currentX - p.lifelineX);
        if (dist < minDistance) {
          minDistance = dist;
          closestPart = p;
        }
      });

      setDragTargetPartId(closestPart.id);
      dragTargetPartIdRef.current = closestPart.id;
    };

    const handlePointerUp = () => {
      const targetId = dragTargetPartIdRef.current;

      setDraggedMsgLineIndex(null);
      setDragTargetPartId(null);
      dragTargetPartIdRef.current = null;

      if (dragMsgStartRef.current && targetId !== null) {
        const msg = messages.find(m => m.lineIndex === lineIndex);
        if (msg) {
          const originalFrom = msg.from;
          const originalTo = msg.to;
          const newFrom = handleType === 'from' ? targetId : originalFrom;
          const newTo = handleType === 'to' ? targetId : originalTo;

          if (newFrom !== originalFrom || newTo !== originalTo) {
            onUpdateMessageConnection(lineIndex, newFrom, newTo);
          }
        }
      }

      dragMsgStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [participants, messages, onUpdateMessageConnection, zoom]);

  // Compute indicator X coordinate for the target gap
  let dragIndicatorX = 0;
  if (dragTargetGap !== null && participants.length > 0) {
    const m = participants.length;
    if (dragTargetGap === 0) {
      dragIndicatorX = participants[0].x - 16;
    } else if (dragTargetGap === m) {
      const last = participants[m - 1];
      dragIndicatorX = last.x + last.width + 16;
    } else {
      const prev = participants[dragTargetGap - 1];
      const cur = participants[dragTargetGap];
      dragIndicatorX = (prev.x + prev.width + cur.x) / 2;
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* 1. Drag target gap dashed column indicator (drop_participant.png style) */}
      {draggedPartId && dragTargetGap !== null && participants.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${dragIndicatorX - 50}px`,
            top: `${participants[0].y - 8}px`,
            width: '100px',
            height: `${participants[0].lifelineBottom + participants[0].bottomHeight - participants[0].y + 16}px`,
          }}
          className="border-2 border-dashed border-indigo-500 bg-indigo-500/10 rounded-lg pointer-events-none animate-pulse z-10"
        />
      )}

      {/* 2. Render Participant Overlays */}
      {participants.map((part, index) => (
        <SequenceParticipantOverlay
          key={`participant-${part.id}`}
          participant={part}
          isSelected={selectedPartId === part.id}
          isEditing={editingPartId === part.id}
          onSelect={() => {
            setSelectedPartId(part.id);
            setEditingPartId(null);
            setSelectedLineIndex(null);
            setEditingLineIndex(null);
          }}
          onStartRename={() => setEditingPartId(part.id)}
          onRenameCommit={(newName) => {
            onUpdateParticipant(part.id, newName, part.type);
            setEditingPartId(null);
          }}
          onRenameCancel={() => setEditingPartId(null)}
          onTypeChange={(newType) => {
            onUpdateParticipant(part.id, part.alias, newType);
          }}
          onDelete={() => {
            onDeleteParticipant(part.id);
            setSelectedPartId(null);
          }}
          onDragStart={(e) => handleDragStart(e, part.id, index)}
          isLight={isLight}
          zoom={zoom}
        />
      ))}

      {/* 3. Render Message Overlays */}
      {messages.map((msg) => {
        const fromPart = participants.find(p => p.id === msg.from);
        const toPart = participants.find(p => p.id === msg.to);
        const fromX = fromPart ? fromPart.lifelineX : msg.x;
        const toX = toPart ? toPart.lifelineX : msg.x + msg.width;

        return (
          <SequenceMessageOverlay
            key={`message-${msg.lineIndex}`}
            message={msg}
            fromX={fromX}
            toX={toX}
            isSelected={selectedLineIndex === msg.lineIndex}
            isEditing={editingLineIndex === msg.lineIndex}
            onSelect={() => {
              setSelectedLineIndex(msg.lineIndex);
              setEditingLineIndex(null);
              setSelectedPartId(null);
              setEditingPartId(null);
            }}
            onStartRename={() => setEditingLineIndex(msg.lineIndex)}
            onRenameCommit={(newLabel) => {
              onUpdateMessage(msg.lineIndex, newLabel, msg.arrow);
              setEditingLineIndex(null);
            }}
            onRenameCancel={() => setEditingLineIndex(null)}
            onStyleChange={(newStyle) => {
              onUpdateMessage(msg.lineIndex, msg.label, newStyle);
            }}
            onReverse={() => {
              onReverseMessage(msg.lineIndex);
              setSelectedLineIndex(null);
            }}
            onDelete={() => {
              onDeleteMessage(msg.lineIndex);
              setSelectedLineIndex(null);
            }}
            onDragStart={(e, type) => handleMsgDragStart(e, msg.lineIndex, type, type === 'from' ? fromX : toX)}
            isLight={isLight}
            zoom={zoom}
          />
        );
      })}

      {/* 4. Drag target lifeline vertical dashed line indicator */}
      {draggedMsgLineIndex !== null && dragTargetPartId && participants.length > 0 && (() => {
        const targetPart = participants.find(p => p.id === dragTargetPartId);
        if (!targetPart) return null;
        return (
          <div
            style={{
              position: 'absolute',
              left: `${targetPart.lifelineX - 10}px`,
              top: `${participants[0].lifelineTop}px`,
              width: '20px',
              height: `${participants[0].lifelineBottom - participants[0].lifelineTop}px`,
            }}
            className="border-l-2 border-r-2 border-dashed border-indigo-500 bg-indigo-500/10 pointer-events-none animate-pulse z-30"
          />
        );
      })()}

      {/* 5. Render Action Add Buttons (+ buttons along lifelines) */}
      {!draggedPartId && !draggedMsgLineIndex && (
        <SequenceAddButtons
          participants={participants}
          messages={messages}
          onAddParticipant={onAddParticipant}
          onAddMessage={onAddMessage}
          isLight={isLight}
        />
      )}
    </div>
  );
}
