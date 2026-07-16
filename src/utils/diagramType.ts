export type DiagramType = 'flowchart' | 'sequence' | 'unknown';

export function detectDiagramType(code: string): DiagramType {
  const trimmed = code.trim();
  if (!trimmed) {
    return 'unknown';
  }

  // Look for the first non-comment line
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const cleanLine = line.replace(/%%.*/, '').trim();
    if (!cleanLine) {
      continue;
    }

    if (cleanLine.startsWith('sequenceDiagram')) {
      return 'sequence';
    }
    if (cleanLine.startsWith('flowchart') || cleanLine.startsWith('graph')) {
      return 'flowchart';
    }
    break;
  }

  // Fallback to searching anywhere near the start
  if (/^\s*(?:%%[^\n]*\n)*\s*sequenceDiagram/i.test(trimmed)) {
    return 'sequence';
  }
  if (/^\s*(?:%%[^\n]*\n)*\s*(?:flowchart|graph)/i.test(trimmed)) {
    return 'flowchart';
  }

  return 'unknown';
}
