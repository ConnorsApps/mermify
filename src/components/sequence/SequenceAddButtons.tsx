import { memo } from 'react';
import { Plus } from 'lucide-react';
import type { SequenceParticipantBounds, SequenceMessageBounds } from '../../utils/sequenceSvgParser';

interface SequenceAddButtonsProps {
  participants: SequenceParticipantBounds[];
  messages: SequenceMessageBounds[];
  onAddParticipant: (type: string, afterId?: string) => void;
  onAddMessage: (from: string, to: string, arrow: string, label: string, afterLineIndex: number) => void;
  isLight: boolean;
}

export const SequenceAddButtons = memo(function SequenceAddButtons({
  participants,
  messages,
  onAddParticipant,
  onAddMessage,
  isLight,
}: SequenceAddButtonsProps) {
  if (participants.length === 0) return null;

  // 1. Participant add button (floats to the right of the last top participant box)
  const lastPart = participants[participants.length - 1];
  const addPartX = lastPart.x + lastPart.width + 16;
  const addPartY = lastPart.y + lastPart.height / 2 - 14;

  // 2. Lifeline Slot Add Message Buttons
  // Group slots for each participant's lifeline
  const sortedMessages = [...messages].sort((a, b) => a.lineY - b.lineY);
  const n = sortedMessages.length;

  // The top slot must sit below ALL participant header shapes, not just its own.
  // Shapes differ in height (actor stickfigure > rectangle > entity circle), so each
  // participant's lifelineTop differs. Using the global max keeps the first row of
  // "+" buttons on a shared horizontal line.
  const globalLifelineTop = Math.max(...participants.map(p => p.lifelineTop));

  interface LifelineSlot {
    fromId: string;
    toId: string;
    x: number;
    y: number;
    afterLineIndex: number; // lineIndex of the message after which this is inserted (-1 for start)
  }

  const slots: LifelineSlot[] = [];

  participants.forEach((part, partIdx) => {
    const defaultTargetIdx = partIdx === participants.length - 1 ? partIdx - 1 : partIdx + 1;
    const targetPart = participants[defaultTargetIdx];
    if (!targetPart) return;

    const x = part.lifelineX;
    const bottom = part.lifelineBottom;

    if (n === 0) {
      // Position the slot close to the top actors
      slots.push({
        fromId: part.id,
        toId: targetPart.id,
        x,
        y: globalLifelineTop + 40,
        afterLineIndex: -1
      });
    } else {
      // Slot 0 (between shared top-of-lifelines baseline and first message)
      const firstMsgLineY = sortedMessages[0].lineY;
      slots.push({
        fromId: part.id,
        toId: targetPart.id,
        x,
        y: Math.max(globalLifelineTop + 8, (globalLifelineTop + firstMsgLineY) / 2),
        afterLineIndex: -1
      });

      // Slots between messages
      for (let i = 0; i < n - 1; i++) {
        const curMsgLineY = sortedMessages[i].lineY;
        const nextMsgLineY = sortedMessages[i + 1].lineY;
        slots.push({
          fromId: part.id,
          toId: targetPart.id,
          x,
          y: (curMsgLineY + nextMsgLineY) / 2,
          afterLineIndex: sortedMessages[i].lineIndex
        });
      }

      // Slot N (between last message and bottom of lifeline)
      const lastMsgLineY = sortedMessages[n - 1].lineY;

      let msgSpacing = 45; // default fallback
      if (n > 1) {
        let totalSpacing = 0;
        for (let i = 0; i < n - 1; i++) {
          const curY = sortedMessages[i].lineY;
          const nextY = sortedMessages[i + 1].lineY;
          totalSpacing += (nextY - curY);
        }
        msgSpacing = totalSpacing / (n - 1);
      }

      const y = Math.min(lastMsgLineY + msgSpacing / 2, bottom - 16);

      slots.push({
        fromId: part.id,
        toId: targetPart.id,
        x,
        y,
        afterLineIndex: sortedMessages[n - 1].lineIndex
      });
    }
  });

  return (
    <>
      {/* 1. Add Participant button on the right of the header row */}
      <div
        style={{
          position: 'absolute',
          left: `${addPartX}px`,
          top: `${addPartY}px`,
        }}
        className="pointer-events-auto z-30"
      >
        <button
          onClick={() => onAddParticipant('participant', lastPart.id)}
          className={`w-7 h-7 rounded-full flex items-center justify-center border shadow-lg transition-all active:scale-95 cursor-pointer ${
            isLight
              ? 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50'
              : 'bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-850'
          }`}
          title="Add Participant"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Add Message buttons along each lifeline */}
      {slots.map((slot, index) => (
        <div
          key={`lifeline-slot-${slot.fromId}-${index}`}
          data-testid={`lifeline-slot-${slot.fromId}`}
          style={{
            position: 'absolute',
            left: `${slot.x}px`,
            top: `${slot.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
          className="pointer-events-none group/slot z-20"
        >
          {/* Invisible hover-trigger container for a clean visual appearance */}
          <div className="w-6 h-6 flex items-center justify-center pointer-events-auto">
            <button
              onClick={() => onAddMessage(slot.fromId, slot.toId, '->>', 'new msg', slot.afterLineIndex)}
              className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-150 cursor-pointer pointer-events-auto shadow-md ${
                messages.length === 0
                  ? 'opacity-80 hover:opacity-100 scale-110 bg-indigo-500 text-slate-950 border-indigo-500'
                  : 'opacity-0 group-hover/slot:opacity-100'
              } ${
                isLight
                  ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
                  : 'bg-indigo-500 border-indigo-500 text-slate-950 hover:bg-indigo-400 active:scale-95'
              }`}
              title="Insert Message Here"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      ))}
    </>
  );
});
