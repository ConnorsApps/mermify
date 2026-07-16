import { getElementMidpoint } from './svgParser';
import type { SequenceParticipant, SequenceMessage } from './sequenceParser';

export interface SequenceParticipantBounds {
  id: string;
  alias: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bottomX: number;
  bottomY: number;
  bottomWidth: number;
  bottomHeight: number;
  lifelineX: number;
  lifelineTop: number;
  lifelineBottom: number;
}

export interface SequenceMessageBounds {
  lineIndex: number;
  from: string;
  to: string;
  arrow: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasLabel: boolean;
  lineY: number;
}

/**
 * Extracts sequence diagram overlay positions from the rendered SVG.
 */
export function calculateSequenceSvgBounds(
  viewport: HTMLDivElement,
  parsedParticipants: SequenceParticipant[],
  parsedMessages: SequenceMessage[],
  zoom: number
): { participants: SequenceParticipantBounds[]; messages: SequenceMessageBounds[] } {
  const viewportRect = viewport.getBoundingClientRect();
  const svgNode = viewport.querySelector('svg');
  if (!svgNode) {
    return { participants: [], messages: [] };
  }

  // 1. Process Participants (actor elements)
  // Filter out any elements that are hidden (width or height is 0) to ignore hidden bottom actors when mirrorActors is false
  const actorElements = Array.from(viewport.querySelectorAll('.actor')).filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (actorElements.length === 0) {
    return { participants: [], messages: [] };
  }

  // Group actor elements by their horizontal center X
  interface ActorWithRect {
    element: Element;
    rect: DOMRect;
    centerX: number;
  }

  const actorsWithRect: ActorWithRect[] = actorElements.map(el => {
    const rect = el.getBoundingClientRect();
    const unscaledLeft = (rect.left - viewportRect.left) / zoom;
    const unscaledRight = (rect.right - viewportRect.left) / zoom;
    return {
      element: el,
      rect,
      centerX: (unscaledLeft + unscaledRight) / 2
    };
  });

  // Group by horizontal center (with a tolerance of 10px)
  const groups: ActorWithRect[][] = [];
  actorsWithRect.forEach(actor => {
    let added = false;
    for (const group of groups) {
      if (Math.abs(group[0].centerX - actor.centerX) < 15) {
        group.push(actor);
        added = true;
        break;
      }
    }
    if (!added) {
      groups.push([actor]);
    }
  });

  // Sort groups from left to right by their average centerX
  groups.sort((a, b) => {
    const avgA = a.reduce((sum, item) => sum + item.centerX, 0) / a.length;
    const avgB = b.reduce((sum, item) => sum + item.centerX, 0) / b.length;
    return avgA - avgB;
  });

  const participantsBounds: SequenceParticipantBounds[] = [];

  // Map each group to the corresponding parsed participant
  parsedParticipants.forEach((part, index) => {
    const group = groups[index];
    if (!group) return;

    // Sort items in the group by Y coordinate (smaller is top, larger is bottom)
    group.sort((a, b) => a.rect.top - b.rect.top);

    // Find the largest vertical gap between consecutive elements to split top vs bottom actor boxes
    let maxGap = 0;
    let gapIndex = -1;
    for (let i = 0; i < group.length - 1; i++) {
      const gap = group[i + 1].rect.top - group[i].rect.top;
      if (gap > maxGap) {
        maxGap = gap;
        gapIndex = i;
      }
    }

    const topActor = group[0];
    // If the largest vertical gap is significant (> 50px), the elements after the gap belong to the bottom box
    const bottomActor = (gapIndex !== -1 && maxGap > 50) ? group[gapIndex + 1] : group[0];

    const topW = topActor.rect.width / zoom;
    const topH = topActor.rect.height / zoom;
    const topX = (topActor.rect.left - viewportRect.left) / zoom;
    const topY = (topActor.rect.top - viewportRect.top) / zoom;

    const botW = bottomActor.rect.width / zoom;
    const botH = bottomActor.rect.height / zoom;
    const botX = (bottomActor.rect.left - viewportRect.left) / zoom;
    const botY = (bottomActor.rect.top - viewportRect.top) / zoom;

    const lifelineX = topX + topW / 2;
    // Start with actor-box-bottom as a safe fallback for lifelineTop,
    // and either botY (mirrorActors=true) or actor-box-bottom (mirrorActors=false) for lifelineBottom.
    let lifelineTop = topY + topH;
    let lifelineBottom = (bottomActor === topActor) ? lifelineTop : botY;

    // Always scan for the actual vertical lifeline element in the SVG.
    // This corrects lifelineTop for non-rectangular shapes (entity, boundary, etc.) whose
    // .actor bounding box ends ABOVE where the dashed lifeline actually begins, and also
    // gives an accurate lifelineBottom when mirrorActors is false.
    const candidateLines = Array.from(viewport.querySelectorAll('line, path'));
    let bestDistX = Infinity;
    let matchedByClass = false;

    candidateLines.forEach(line => {
      const lineRect = line.getBoundingClientRect();
      const unscaledHeight = lineRect.height / zoom;
      const unscaledWidth = lineRect.width / zoom;

      // A vertical lifeline: tall (>20 unscaled px) and narrow (<15 unscaled px)
      if (unscaledHeight > 20 && unscaledWidth < 15) {
        const lineCenterX = ((lineRect.left + lineRect.right) / 2 - viewportRect.left) / zoom;
        const participantCenterX = ((topActor.rect.left + topActor.rect.right) / 2 - viewportRect.left) / zoom;
        const distX = Math.abs(lineCenterX - participantCenterX);

        if (distX < 15) {
          const className = line.getAttribute('class') || '';
          const isActorLine = className.includes('actor-line') || className.includes('lifeline');

          const isBetter = isActorLine
            ? (!matchedByClass || distX < bestDistX)
            : (!matchedByClass && distX < bestDistX);

          if (isBetter) {
            if (isActorLine) matchedByClass = true;
            bestDistX = distX;
            lifelineTop = (lineRect.top - viewportRect.top) / zoom;
            lifelineBottom = (lineRect.bottom - viewportRect.top) / zoom;
          }
        }
      }
    });

    // Expand the header bounding box to cover the full icon + label for every shape type.
    // Mermaid renders different shapes with inconsistent .actor class placement:
    //   - actor/boundary/control: icon is a sibling element (e.g. .actor-man), only label has .actor class
    //   - database: cylinder has .actor class but the text label is a sibling below it
    // By scanning ALL leaf SVG elements in the participant's horizontal column above the
    // lifeline we get the true visual extent without relying on Mermaid-internal class names.
    const halfColWidth = Math.max(topW / 2, 20);
    let headerLeft   = topX;
    let headerRight  = topX + topW;
    let headerTopY   = topY;
    let headerBottomY = topY + topH;

    const nearbyElements = Array.from(
      svgNode.querySelectorAll('rect, circle, ellipse, polygon, polyline, text, path')
    );
    nearbyElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const elW = rect.width  / zoom;
      const elH = rect.height / zoom;

      if (elW < 2 || elH < 2) return;          // invisible / tiny SVG markers
      if (elW > topW * 3)       return;          // wide full-diagram spans (message arrows etc.)
      if (elH > 120)            return;          // tall elements (lifelines, activation boxes)

      const elLeft    = (rect.left   - viewportRect.left) / zoom;
      const elRight   = (rect.right  - viewportRect.left) / zoom;
      const elCenterX = (elLeft + elRight) / 2;
      const elTop     = (rect.top    - viewportRect.top)  / zoom;
      const elBottom  = (rect.bottom - viewportRect.top)  / zoom;

      // Must be centred within the participant's horizontal column
      if (Math.abs(elCenterX - lifelineX) > halfColWidth) return;
      // Must sit fully within the header zone: from 100 px above topY to the lifeline start
      if (elTop    < topY - 100) return;
      if (elBottom > lifelineTop + 5) return;

      headerLeft    = Math.min(headerLeft,   elLeft);
      headerRight   = Math.max(headerRight,  elRight);
      headerTopY    = Math.min(headerTopY,   elTop);
      headerBottomY = Math.max(headerBottomY, elBottom);
    });

    // Enforce symmetry around lifelineX so that the overlay center x always equals
    // lifelineX. Without this, shapes where the icon is wider on one side than the
    // other (e.g. stickfigure actor with a narrow text label) produce an asymmetric
    // bounding box whose center drifts from lifelineX. The drag handle positions are
    // keyed to lifelineX, so any mismatch breaks coordinate comparisons.
    const halfExpanded = Math.max(lifelineX - headerLeft, headerRight - lifelineX);
    const finalX = lifelineX - halfExpanded;
    const finalY = headerTopY;
    const finalW = halfExpanded * 2;
    const finalH = headerBottomY - headerTopY;

    participantsBounds.push({
      id: part.id,
      alias: part.alias,
      type: part.type,
      x: finalX,
      y: finalY,
      width:  finalW,
      height: finalH,
      bottomX: botX,
      bottomY: botY,
      bottomWidth: botW,
      bottomHeight: botH,
      lifelineX,
      lifelineTop,
      lifelineBottom
    });
  });

  // 2. Process Messages
  // Message lines are usually paths or lines matching messageLine class or within .message class
  const lineElements = Array.from(
    viewport.querySelectorAll('.messageLine, [class*="messageLine"], .message path, .message line')
  );

  // Filter out any elements that have a width/height of 0 or are not path/line
  const validLineElements = lineElements.filter(el => {
    const tagName = el.tagName.toLowerCase();
    return tagName === 'path' || tagName === 'line';
  });

  // Sort message line elements by their vertical center position
  interface MessageLineWithCenter {
    element: Element;
    rect: DOMRect;
    centerY: number;
  }

  const linesWithCenter: MessageLineWithCenter[] = validLineElements.map(el => {
    const rect = el.getBoundingClientRect();
    return {
      element: el,
      rect,
      centerY: (rect.top + rect.bottom) / 2
    };
  });

  // Deduplicate lines that have very close vertical centers (Mermaid sometimes uses multiple segments/markers)
  const uniqueLines: MessageLineWithCenter[] = [];
  linesWithCenter.sort((a, b) => a.centerY - b.centerY);
  linesWithCenter.forEach(line => {
    if (uniqueLines.length === 0) {
      uniqueLines.push(line);
    } else {
      const last = uniqueLines[uniqueLines.length - 1];
      if (Math.abs(last.centerY - line.centerY) > 10) {
        uniqueLines.push(line);
      }
    }
  });

  // Sort uniqueLines top to bottom
  uniqueLines.sort((a, b) => a.centerY - b.centerY);

  // Query all message texts
  const textElements = Array.from(viewport.querySelectorAll('.messageText'));

  const messagesBounds: SequenceMessageBounds[] = [];

  // Map each sorted line element to parsedMessages
  parsedMessages.forEach((msg, index) => {
    const lineItem = uniqueLines[index];
    if (!lineItem) return;

    // Find the message text corresponding to this message line
    // It should be the closest text element vertically
    let closestText: Element | null = null;
    let minDiffY = Infinity;
    textElements.forEach(textEl => {
      const textRect = textEl.getBoundingClientRect();
      const textCenterY = (textRect.top + textRect.bottom) / 2;
      const diffY = Math.abs(textCenterY - lineItem.centerY);
      if (diffY < minDiffY && diffY < 35) { // 35px vertical tolerance
        minDiffY = diffY;
        closestText = textEl;
      }
    });

    const hasLabel = closestText !== null && msg.label !== '';
    let x = 0, y = 0, w = 0, h = 0;

    if (hasLabel && closestText) {
      const textRect = (closestText as Element).getBoundingClientRect();
      w = textRect.width / zoom;
      h = textRect.height / zoom;
      x = (textRect.left - viewportRect.left) / zoom;
      y = (textRect.top - viewportRect.top) / zoom;
    } else {
      // Fallback: draw a small interactive overlay circle/rect around the midpoint of the line
      const lineMid = getElementMidpoint(lineItem.element);
      w = 20;
      h = 20;
      x = (lineMid.x - viewportRect.left) / zoom - w / 2;
      y = (lineMid.y - viewportRect.top) / zoom - h / 2;
    }

    const lineY = (lineItem.centerY - viewportRect.top) / zoom;

    messagesBounds.push({
      lineIndex: msg.lineIndex,
      from: msg.from,
      to: msg.to,
      arrow: msg.arrow,
      label: msg.label,
      x,
      y,
      width: w,
      height: h,
      hasLabel,
      lineY
    });
  });

  return {
    participants: participantsBounds,
    messages: messagesBounds
  };
}
