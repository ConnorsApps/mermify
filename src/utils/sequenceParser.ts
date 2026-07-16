export interface SequenceParticipant {
  id: string;
  alias: string;
  type: string; // 'participant' | 'actor' | 'boundary' | 'control' | 'entity' | 'collections' | 'database' | 'queue'
}

export interface SequenceMessage {
  from: string;
  to: string;
  arrow: string;
  label: string;
  lineIndex: number;
}

// Map of standard mermaid shapes
export const PARTICIPANT_TYPES = [
  { id: 'participant', name: 'Participant' },
  { id: 'actor', name: 'Actor' },
  { id: 'boundary', name: 'Boundary' },
  { id: 'control', name: 'Control' },
  { id: 'entity', name: 'Entity' },
  { id: 'collections', name: 'Collections' },
  { id: 'database', name: 'Database' },
  { id: 'queue', name: 'Queue' }
];

/**
 * Parses the participants in a sequence diagram.
 * It first finds all explicit declarations (participant/actor),
 * then checks all messages to find any undeclared participants.
 */
export function parseSequenceParticipants(code: string): SequenceParticipant[] {
  const participants: SequenceParticipant[] = [];
  const declaredIds = new Set<string>();

  const lines = code.split('\n');

  // Regex to match explicit declarations:
  // e.g. participant Bob
  // e.g. actor Alice as New Alice
  // e.g. participant P1 as New Boundary @{ type: "boundary" }
  // e.g. participant A1@{ type: "entity" } as New Actor
  const declRegex = /^\s*(participant|actor)\s+([a-zA-Z0-9_-]+)(?:\s*@\{\s*(?:"(?:type|shape)"|'(?:type|shape)'|(?:type|shape))\s*:\s*(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_-]+))\s*\})?(?:\s+as\s+(?:"([^"]*)"|'([^']*)'|([^\n]+)))?/i;
  
  // Another order: participant Bob as Bob @{ type: "collections" }
  const declRegexAlt = /^\s*(participant|actor)\s+([a-zA-Z0-9_-]+)(?:\s+as\s+(?:"([^"]*)"|'([^']*)'|([^@\n]+)))?(?:\s*@\{\s*(?:"(?:type|shape)"|'(?:type|shape)'|(?:type|shape))\s*:\s*(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_-]+))\s*\})?/i;

  for (const line of lines) {
    const cleanLine = line.replace(/%%.*/, '').trim();
    if (!cleanLine) continue;

    // Try first regex
    let match = cleanLine.match(declRegex);
    if (match) {
      const keyword = match[1].toLowerCase();
      const id = match[2];
      const shapeType = match[3] || match[4] || match[5];
      const alias = match[6] || match[7] || match[8] || id;

      if (!declaredIds.has(id)) {
        let type = keyword; // 'participant' or 'actor'
        if (shapeType) {
          type = shapeType;
        }
        participants.push({
          id,
          alias: alias.trim(),
          type: type.toLowerCase()
        });
        declaredIds.add(id);
      }
      continue;
    }

    // Try second regex
    match = cleanLine.match(declRegexAlt);
    if (match) {
      const keyword = match[1].toLowerCase();
      const id = match[2];
      const alias = match[3] || match[4] || match[5] || id;
      const shapeType = match[6] || match[7] || match[8];

      if (!declaredIds.has(id)) {
        let type = keyword;
        if (shapeType) {
          type = shapeType;
        }
        participants.push({
          id,
          alias: alias.trim(),
          type: type.toLowerCase()
        });
        declaredIds.add(id);
      }
    }
  }

  // Find undeclared participants used in messages
  const msgRegex = /^\s*([a-zA-Z0-9_-]+?)\s*(->>|-->>|->|-->|-x|--x)\s*([a-zA-Z0-9_-]+)\s*:/i;
  for (const line of lines) {
    const cleanLine = line.replace(/%%.*/, '').trim();
    if (!cleanLine) continue;

    const match = cleanLine.match(msgRegex);
    if (match) {
      const from = match[1];
      const to = match[3];

      // Ignore standard keywords
      const keywords = ['participant', 'actor', 'sequenceDiagram', 'autonumber', 'note', 'loop', 'alt', 'opt', 'end'];
      
      if (!declaredIds.has(from) && !keywords.includes(from)) {
        participants.push({ id: from, alias: from, type: 'participant' });
        declaredIds.add(from);
      }
      if (!declaredIds.has(to) && !keywords.includes(to)) {
        participants.push({ id: to, alias: to, type: 'participant' });
        declaredIds.add(to);
      }
    }
  }

  return participants;
}

/**
 * Parses the messages in the sequence diagram.
 */
export function parseSequenceMessages(code: string): SequenceMessage[] {
  const messages: SequenceMessage[] = [];
  const lines = code.split('\n');
  const msgRegex = /^\s*([a-zA-Z0-9_-]+?)\s*(->>|-->>|->|-->|-x|--x)\s*([a-zA-Z0-9_-]+)\s*:\s*(.*)$/i;

  lines.forEach((line, index) => {
    const cleanLine = line.replace(/%%.*/, '').trim();
    if (!cleanLine) return;

    const match = cleanLine.match(msgRegex);
    if (match) {
      messages.push({
        from: match[1],
        to: match[3],
        arrow: match[2],
        label: match[4].trim(),
        lineIndex: index
      });
    }
  });

  return messages;
}

/**
 * Adds a new participant to the sequence diagram code.
 */
export function addParticipant(
  code: string,
  type: string = 'participant',
  afterId?: string
): string {
  const lines = code.split('\n');
  
  // Find a unique ID
  const participants = parseSequenceParticipants(code);
  let counter = 1;
  while (participants.some(p => p.id === `P${counter}`)) {
    counter++;
  }
  const newId = `P${counter}`;
  const newAlias = `Participant ${counter}`;

  // Format line: participant P1 as Participant 1 or participant P1@{type: "boundary"} as Participant 1
  let newLine = '';
  const standardTypes = ['participant', 'actor'];
  if (standardTypes.includes(type)) {
    newLine = `    ${type} ${newId} as ${newAlias}`;
  } else {
    newLine = `    participant ${newId}@{ "type": "${type}" } as ${newAlias}`;
  }

  let insertIndex = -1;

  if (afterId) {
    // Find the index of the line declaring afterId
    const declRegex = new RegExp(`^\\s*(participant|actor)\\s+${afterId}\\b`, 'i');
    for (let i = 0; i < lines.length; i++) {
      if (declRegex.test(lines[i])) {
        insertIndex = i + 1;
        break;
      }
    }
  }

  // If insertIndex not found, insert after sequenceDiagram / autonumber
  if (insertIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('sequenceDiagram')) {
        insertIndex = i + 1;
        // Check if next line is autonumber
        if (i + 1 < lines.length && lines[i + 1].trim() === 'autonumber') {
          insertIndex = i + 2;
        }
        break;
      }
    }
  }

  if (insertIndex === -1) {
    // Fallback: prepend sequenceDiagram if not found
    return `sequenceDiagram\n${newLine}\n` + code;
  }

  lines.splice(insertIndex, 0, newLine);
  return lines.join('\n');
}

/**
 * Updates a participant's alias (display name) or type.
 */
export function updateParticipant(
  code: string,
  id: string,
  newAlias: string,
  newType: string
): string {
  const lines = code.split('\n');
  const declRegex = new RegExp(`^(\\s*)(participant|actor)\\s+(${id})\\b([^]*)$`, 'i');

  let updated = false;

  const updatedLines = lines.map(line => {
    if (updated) return line;

    const match = line.match(declRegex);
    if (match) {
      updated = true;
      const indent = match[1];
      const standardTypes = ['participant', 'actor'];
      
      let newline = '';
      if (standardTypes.includes(newType)) {
        newline = `${indent}${newType} ${id} as ${newAlias}`;
      } else {
        newline = `${indent}participant ${id}@{ "type": "${newType}" } as ${newAlias}`;
      }
      return newline;
    }
    return line;
  });

  if (updated) {
    return updatedLines.join('\n');
  }

  // If participant declaration was not explicit, let's prepend it
  const insertIndex = 1;
  const standardTypes = ['participant', 'actor'];
  let declLine = '';
  if (standardTypes.includes(newType)) {
    declLine = `    ${newType} ${id} as ${newAlias}`;
  } else {
    declLine = `    participant ${id}@{ "type": "${newType}" } as ${newAlias}`;
  }

  lines.splice(insertIndex, 0, declLine);
  return lines.join('\n');
}

/**
 * Deletes a participant and any messages involving it.
 */
export function deleteParticipant(code: string, id: string): string {
  const lines = code.split('\n');
  const declRegex = new RegExp(`^\\s*(participant|actor)\\s+${id}\\b`, 'i');
  const msgRegex = new RegExp(`^\\s*(${id}\\s*(->>|-->>|->|-->|-x|--x)|[a-zA-Z0-9_-]+\\s*(->>|-->>|->|-->|-x|--x)\\s*${id}\\s*:)`, 'i');

  const filteredLines = lines.filter(line => {
    const cleanLine = line.replace(/%%.*/, '').trim();
    if (!cleanLine) return true;

    if (declRegex.test(cleanLine)) {
      return false; // delete declaration
    }
    if (msgRegex.test(cleanLine)) {
      return false; // delete message involving it
    }
    return true;
  });

  return filteredLines.join('\n');
}

/**
 * Reorders participants in the diagram code.
 */
export function reorderParticipants(code: string, newOrder: string[]): string {
  const lines = code.split('\n');
  const participants = parseSequenceParticipants(code);

  // Extract all existing explicit declaration lines, delete them, and keep non-declaration lines
  const declarationsMap = new Map<string, string>();
  
  // Find and remove all participant declarations from original lines
  const declRegex = /^\s*(participant|actor)\s+([a-zA-Z0-9_-]+)\b/i;
  
  const cleanLines = lines.filter(line => {
    const match = line.match(declRegex);
    if (match) {
      const id = match[2];
      declarationsMap.set(id, line);
      return false;
    }
    return true;
  });

  // Re-insert declarations in the new order right after sequenceDiagram / autonumber
  let insertIndex = -1;
  for (let i = 0; i < cleanLines.length; i++) {
    const trimmed = cleanLines[i].trim();
    if (trimmed.startsWith('sequenceDiagram')) {
      insertIndex = i + 1;
      if (i + 1 < cleanLines.length && cleanLines[i + 1].trim() === 'autonumber') {
        insertIndex = i + 2;
      }
      break;
    }
  }

  if (insertIndex === -1) {
    insertIndex = 0;
  }

  const newDeclLines: string[] = [];
  newOrder.forEach(id => {
    const existingLine = declarationsMap.get(id);
    if (existingLine) {
      newDeclLines.push(existingLine);
    } else {
      // Find parsed participant to reconstruct declaration if it wasn't explicit before
      const p = participants.find(part => part.id === id);
      if (p) {
        const standardTypes = ['participant', 'actor'];
        if (standardTypes.includes(p.type)) {
          newDeclLines.push(`    ${p.type} ${p.id} as ${p.alias}`);
        } else {
          newDeclLines.push(`    participant ${p.id}@{ "type": "${p.type}" } as ${p.alias}`);
        }
      }
    }
  });

  cleanLines.splice(insertIndex, 0, ...newDeclLines);
  return cleanLines.join('\n');
}

/**
 * Inserts a new message at a specific line index position.
 */
export function addMessage(
  code: string,
  from: string,
  to: string,
  arrow: string = '->>',
  label: string = 'new msg',
  afterLineIndex?: number
): string {
  const lines = code.split('\n');
  const newLine = `    ${from}${arrow}${to}: ${label}`;

  if (afterLineIndex === undefined) {
    lines.push(newLine);
  } else if (afterLineIndex === -1) {
    const messages = parseSequenceMessages(code);
    if (messages.length > 0) {
      const firstMsgLineIndex = Math.min(...messages.map(m => m.lineIndex));
      lines.splice(firstMsgLineIndex, 0, newLine);
    } else {
      // Find where to insert if no messages exist yet
      let insertIndex = -1;
      const declRegex = /^\s*(participant|actor)\b/i;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (declRegex.test(lines[i])) {
          insertIndex = i + 1;
          break;
        }
      }
      if (insertIndex === -1) {
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (trimmed.startsWith('sequenceDiagram')) {
            insertIndex = i + 1;
            if (i + 1 < lines.length && lines[i + 1].trim() === 'autonumber') {
              insertIndex = i + 2;
            }
            break;
          }
        }
      }
      if (insertIndex !== -1) {
        lines.splice(insertIndex, 0, newLine);
      } else {
        lines.push(newLine);
      }
    }
  } else if (afterLineIndex >= 0 && afterLineIndex < lines.length) {
    lines.splice(afterLineIndex + 1, 0, newLine);
  } else {
    // Append to the end
    lines.push(newLine);
  }

  return lines.join('\n');
}

/**
 * Updates a specific message line's label and arrow styling.
 */
export function updateMessage(
  code: string,
  lineIndex: number,
  newLabel: string,
  newArrow: string
): string {
  const lines = code.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return code;
  }

  const line = lines[lineIndex];
  const msgRegex = /^(\s*)([a-zA-Z0-9_-]+?)\s*(->>|-->>|->|-->|-x|--x)\s*([a-zA-Z0-9_-]+)\s*:\s*(.*)$/i;
  const match = line.match(msgRegex);

  if (match) {
    const indent = match[1];
    const from = match[2];
    const to = match[4];
    lines[lineIndex] = `${indent}${from}${newArrow}${to}: ${newLabel}`;
  }

  return lines.join('\n');
}

/**
 * Deletes a specific message line.
 */
export function deleteMessage(code: string, lineIndex: number): string {
  const lines = code.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return code;
  }

  lines.splice(lineIndex, 1);
  return lines.join('\n');
}

/**
 * Adds or removes 'autonumber' declaration from the sequence diagram code.
 */
export function toggleAutonumber(code: string): string {
  const lines = code.split('\n');
  let autonumberIndex = -1;
  let seqDiagIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === 'autonumber') {
      autonumberIndex = i;
    }
    if (trimmed.startsWith('sequenceDiagram')) {
      seqDiagIndex = i;
    }
  }

  if (autonumberIndex !== -1) {
    // Remove it
    lines.splice(autonumberIndex, 1);
  } else if (seqDiagIndex !== -1) {
    // Add it right after sequenceDiagram
    lines.splice(seqDiagIndex + 1, 0, '    autonumber');
  } else {
    // If sequenceDiagram keyword not found, prepend it with autonumber
    return `sequenceDiagram\n    autonumber\n` + code;
  }

  return lines.join('\n');
}

/**
 * Updates a specific message line's sender (from) and receiver (to) endpoints.
 */
export function updateMessageConnection(
  code: string,
  lineIndex: number,
  newFrom: string,
  newTo: string
): string {
  const lines = code.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return code;
  }

  const line = lines[lineIndex];
  const msgRegex = /^(\s*)([a-zA-Z0-9_-]+?)\s*(->>|-->>|->|-->|-x|--x)\s*([a-zA-Z0-9_-]+)\s*:\s*(.*)$/i;
  const match = line.match(msgRegex);

  if (match) {
    const indent = match[1];
    const arrow = match[3];
    const label = match[5];
    lines[lineIndex] = `${indent}${newFrom}${arrow}${newTo}: ${label}`;
  }

  return lines.join('\n');
}

/**
 * Reverses the direction of a specific message line by swapping its from and to participants.
 */
export function reverseMessage(code: string, lineIndex: number): string {
  const lines = code.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return code;
  }

  const line = lines[lineIndex];
  const msgRegex = /^(\s*)([a-zA-Z0-9_-]+?)\s*(->>|-->>|->|-->|-x|--x)\s*([a-zA-Z0-9_-]+)\s*:\s*(.*)$/i;
  const match = line.match(msgRegex);

  if (match) {
    const indent = match[1];
    const from = match[2];
    const arrow = match[3];
    const to = match[4];
    const label = match[5];
    lines[lineIndex] = `${indent}${to}${arrow}${from}: ${label}`;
  }

  return lines.join('\n');
}


