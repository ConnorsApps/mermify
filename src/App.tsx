import { useState, useEffect, useCallback } from 'react';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import type { OverlayNode } from './components/Preview';
import { PRESETS } from './constants/presets';
import type { PresetKey } from './constants/presets';
import { decompressCode } from './utils/urlCompression';
import { useDiagramState } from './hooks/useDiagramState';
import {
  updateNodeLabelAndShape,
  addNodeConnection,
  deleteNodeFromMermaid,
  updateConnectionInMermaid,
  deleteConnectionFromMermaid,
  detectNodeShapeAndLabel,
  detectConnectionStyle
} from './utils/mermaidParser';
import {
  addParticipant,
  updateParticipant,
  deleteParticipant,
  reorderParticipants,
  addMessage,
  updateMessage,
  deleteMessage,
  toggleAutonumber,
  updateMessageConnection,
  reverseMessage
} from './utils/sequenceParser';
import { Undo2, Redo2, Sun, Moon, HelpCircle, ChevronDown, Sparkles } from 'lucide-react';
import { TourManager } from './components/TourManager';
import { UPDATE_TOURS, CURRENT_TOUR_VERSION } from './constants/tourSteps';

// Extract initial code from URL parameters or fallback to default preset
const getInitialCode = (): string => {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode) {
      const decoded = decompressCode(urlCode);
      if (decoded.trim()) {
        return decoded;
      }
    }
  } catch (e) {
    console.error('Failed to parse initial URL code state:', e);
  }
  return PRESETS.workflow;
};

export default function App() {
  const [editingNode, setEditingNode] = useState<OverlayNode | null>(null);
  const [newNodeIdToEdit, setNewNodeIdToEdit] = useState<string | null>(null);

  const isEditingActive = !!editingNode;

  // Diagram document state hook
  const {
    code,
    debouncedCode,
    updateCode,
    undo,
    redo,
    history,
  } = useDiagramState(getInitialCode(), isEditingActive);

  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('mermify-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('mermify-theme', theme);
  }, [theme]);

  const [isTourDropdownOpen, setIsTourDropdownOpen] = useState(false);
  const [isFlowchartDropdownOpen, setIsFlowchartDropdownOpen] = useState(false);
  const [isSequenceDropdownOpen, setIsSequenceDropdownOpen] = useState(false);
  const [isEditorMounted, setIsEditorMounted] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tour-dropdown-container')) {
        setIsTourDropdownOpen(false);
      }
      if (!target.closest('.flowchart-dropdown-container')) {
        setIsFlowchartDropdownOpen(false);
      }
      if (!target.closest('.sequence-dropdown-container')) {
        setIsSequenceDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Modals state
  const [renderedNodes, setRenderedNodes] = useState<Array<{ id: string; label: string }>>([]);

  // Global undo/redo keyboard shortcuts (with capture phase to override Monaco)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        e.stopPropagation();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [undo, redo]);

  // Preset loading helper
  const handleLoadPreset = useCallback((key: PresetKey) => {
    updateCode(PRESETS[key], true);
    setEditingNode(null);
  }, [updateCode]);

  useEffect(() => {
    const handleTourRelaunch = (e: Event) => {
      const customEvent = e as CustomEvent<{ type?: string }>;
      const type = customEvent.detail?.type || 'full';
      if (type === '0.3.0') {
        handleLoadPreset('sequence');
      }
    };
    window.addEventListener('mermify-relaunch-tour', handleTourRelaunch);
    return () => window.removeEventListener('mermify-relaunch-tour', handleTourRelaunch);
  }, [handleLoadPreset]);

  // Load sequence preset automatically on initial load if version gap triggers the update tour
  useEffect(() => {
    if (!isEditorMounted) return;

    const legacyCompleted = localStorage.getItem('mermify-tour-completed');
    const savedVersion = localStorage.getItem('mermify-tour-version');
    
    let versionToCompare = savedVersion;
    if (!savedVersion && legacyCompleted === 'true') {
      versionToCompare = '0.2.0';
    }

    const versionCheckLessThan = (a: string, b: string): boolean => {
      const partsA = a.split('.').map(Number);
      const partsB = b.split('.').map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const valA = partsA[i] || 0;
        const valB = partsB[i] || 0;
        if (valA < valB) return true;
        if (valA > valB) return false;
      }
      return false;
    };

    if (versionToCompare && versionCheckLessThan(versionToCompare, CURRENT_TOUR_VERSION)) {
      handleLoadPreset('sequence');
    }
  }, [isEditorMounted, handleLoadPreset]);

  // Node real-time label update callback
  const handleNodeLabelChange = useCallback((nodeId: string, newLabel: string) => {
    setEditingNode((prev) => (prev && prev.id === nodeId ? { ...prev, label: newLabel } : prev));

    if (newLabel.trim() === '') {
      return;
    }

    const current = detectNodeShapeAndLabel(code, nodeId);
    const shapeId = current ? current.shapeId : 'rectangle';

    const updatedCode = updateNodeLabelAndShape(
      code,
      nodeId,
      newLabel,
      shapeId
    );
    updateCode(updatedCode, false);
  }, [code, updateCode]);

  // Node shape update callback
  const handleNodeShapeChange = useCallback((nodeId: string, newShapeId: string) => {
    const current = detectNodeShapeAndLabel(code, nodeId);
    const label = current ? current.label : `Node ${nodeId}`;

    const updatedCode = updateNodeLabelAndShape(
      code,
      nodeId,
      label,
      newShapeId
    );
    updateCode(updatedCode, true);
    setEditingNode(null);
  }, [code, updateCode]);

  // Node deletion callback
  const handleDeleteNodeById = useCallback((nodeId: string) => {
    const updatedCode = deleteNodeFromMermaid(code, nodeId);
    updateCode(updatedCode, true);
    if (editingNode?.id === nodeId) {
      setEditingNode(null);
    }
  }, [code, editingNode, updateCode]);

  // Connection inline label update callback
  const handleEdgeLabelChangeInline = useCallback((sourceId: string, targetId: string, newLabel: string) => {
    const currentStyle = detectConnectionStyle(code, sourceId, targetId);
    const updatedCode = updateConnectionInMermaid(
      code,
      sourceId,
      targetId,
      newLabel,
      currentStyle || '-->'
    );
    updateCode(updatedCode, false);
  }, [code, updateCode]);

  // Connection inline style update callback
  const handleEdgeStyleChangeInline = useCallback((sourceId: string, targetId: string, newStyle: string, currentLabel: string) => {
    const updatedCode = updateConnectionInMermaid(
      code,
      sourceId,
      targetId,
      currentLabel,
      newStyle
    );
    updateCode(updatedCode, true);
  }, [code, updateCode]);

  // Connection deletion callback
  const handleDeleteConnectionByEnds = useCallback((sourceId: string, targetId: string) => {
    const updatedCode = deleteConnectionFromMermaid(code, sourceId, targetId);
    updateCode(updatedCode, true);
  }, [code, updateCode]);

  const handleConnectNewNode = (sourceId: string) => {
    // Generate sequential target ID
    let counter = 1;
    while (renderedNodes.some(n => n.id === `N${counter}`)) {
      counter++;
    }
    const targetId = `N${counter}`;
    const targetLabel = `Node ${counter}`;

    // Add connection in code
    const updatedCode = addNodeConnection(
      code,
      sourceId,
      targetId,
      '-->',
      '',
      targetLabel,
      'rectangle'
    );
    updateCode(updatedCode, true);
    setNewNodeIdToEdit(targetId);

    // Auto-trigger editing of the newly created node
    setTimeout(() => {
      setEditingNode({
        id: targetId,
        label: targetLabel,
        shapeId: 'rectangle',
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    }, 450);
  };

  const handleAddNode = () => {
    let counter = 1;
    while (renderedNodes.some(n => n.id === `N${counter}`)) {
      counter++;
    }
    const nodeId = `N${counter}`;
    const nodeLabel = `Node ${counter}`;

    const newLine = `    ${nodeId}[${nodeLabel}]`;
    const updatedCode = code.trim() ? `${code.trimEnd()}\n${newLine}\n` : `flowchart TD\n${newLine}\n`;
    updateCode(updatedCode, true);
    setNewNodeIdToEdit(nodeId);

    setTimeout(() => {
      setEditingNode({
        id: nodeId,
        label: nodeLabel,
        shapeId: 'rectangle',
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    }, 450);
  };

  // Stabilize nodes parsing to prevent infinite rendering cascade loops
  const handleNodesParsed = useCallback((nodes: OverlayNode[]) => {
    setRenderedNodes((prevNodes) => {
      const hasChanged = nodes.length !== prevNodes.length ||
        nodes.some((node, idx) => prevNodes[idx]?.id !== node.id || prevNodes[idx]?.label !== node.label);
      if (!hasChanged) return prevNodes;
      return nodes.map(n => ({ id: n.id, label: n.label }));
    });
  }, []);

  // Sequence callbacks
  const handleAddParticipant = useCallback((type: string, afterId?: string) => {
    const updated = addParticipant(code, type, afterId);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleUpdateParticipant = useCallback((id: string, alias: string, type: string) => {
    const updated = updateParticipant(code, id, alias, type);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleDeleteParticipant = useCallback((id: string) => {
    const updated = deleteParticipant(code, id);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleReorderParticipants = useCallback((newOrder: string[]) => {
    const updated = reorderParticipants(code, newOrder);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleAddMessage = useCallback((from: string, to: string, arrow: string, label: string, afterLineIndex: number) => {
    const updated = addMessage(code, from, to, arrow, label, afterLineIndex);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleUpdateMessage = useCallback((lineIndex: number, label: string, arrow: string) => {
    const updated = updateMessage(code, lineIndex, label, arrow);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleDeleteMessage = useCallback((lineIndex: number) => {
    const updated = deleteMessage(code, lineIndex);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleUpdateMessageConnection = useCallback((lineIndex: number, newFrom: string, newTo: string) => {
    const updated = updateMessageConnection(code, lineIndex, newFrom, newTo);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleReverseMessage = useCallback((lineIndex: number) => {
    const updated = reverseMessage(code, lineIndex);
    updateCode(updated, true);
  }, [code, updateCode]);

  const handleToggleAutonumber = useCallback(() => {
    const updated = toggleAutonumber(code);
    updateCode(updated, true);
  }, [code, updateCode]);




  const isLight = theme === 'light';

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans transition-colors duration-300 ${isLight ? 'bg-slate-50 text-slate-900 theme-light' : 'bg-slate-950 text-slate-100'
      }`}>

      {/* Global Application Nav Bar */}
      <header
        data-testid="toolbar-header"
        className={`flex items-center justify-between px-8 py-4 border-b backdrop-blur-xl z-20 transition-colors duration-300 ${isLight ? 'bg-white/80 border-slate-200/80' : 'bg-slate-900/40 border-slate-800/80'
        }`}
      >
        <div className="flex items-center space-x-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="mermify logo" className="h-10 w-10" />
          <div>
            <h1 className={`text-sm font-black tracking-wider flex items-center space-x-1.5 transition-colors duration-300 ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>
              <span>mermify</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                Hybrid Editor
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/10">
                v0.3.0
              </span>
            </h1>
            <p className={`text-[10px] font-medium transition-colors duration-300 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Click SVG nodes in preview to edit code instantly</p>
          </div>
          <nav className="flex items-center space-x-4">
            <a href={`${import.meta.env.BASE_URL}docs/`} className={`text-sm font-medium transition-colors duration-300 ${isLight ? 'text-slate-700 hover:text-slate-900' : 'text-slate-300 hover:text-slate-100'}`}>Docs</a>
          </nav>
        </div>

        {/* Undo/Redo & Toolbar Presets */}
        <div className="flex items-center space-x-5">
          {/* Undo/Redo Controls */}
          <div className={`flex items-center border rounded-xl p-0.5 shadow-inner transition-colors duration-300 ${isLight ? 'bg-slate-100/60 border-slate-200/80' : 'bg-slate-950/60 border-slate-800/80'
            }`}>
            <button
              onClick={undo}
              disabled={history.past.length === 0}
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${history.past.length > 0
                ? isLight
                  ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200 cursor-pointer'
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800 cursor-pointer'
                : isLight
                  ? 'text-slate-300 opacity-40 cursor-not-allowed'
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
                }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={history.future.length === 0}
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${history.future.length > 0
                ? isLight
                  ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200 cursor-pointer'
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800 cursor-pointer'
                : isLight
                  ? 'text-slate-300 opacity-40 cursor-not-allowed'
                  : 'text-slate-600 opacity-40 cursor-not-allowed'
                }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Presets */}
          {(() => {
            const activeFlowchartPreset = code === PRESETS.flowchart ? 'flowchart' :
                                          code === PRESETS.workflow ? 'workflow' :
                                          code === PRESETS.decision ? 'decision' :
                                          code === PRESETS.devops ? 'devops' : null;
            const activeSequencePreset = code === PRESETS.sequence ? 'sequence' :
                                         code === PRESETS.sequence_auth ? 'sequence_auth' :
                                         code === PRESETS.sequence_db ? 'sequence_db' : null;

            return (
              <div className="flex items-center space-x-3">
                <span className={`text-xs font-semibold transition-colors duration-300 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Presets:
                </span>

                {/* Flowchart Group */}
                <div className="relative flex items-center flowchart-dropdown-container">
                  <div className={`flex items-center rounded-xl border shadow-sm transition-all duration-300 ${
                    activeFlowchartPreset
                      ? isLight
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 hover:border-indigo-600'
                        : 'bg-indigo-600/15 border-indigo-500 text-indigo-300 hover:border-indigo-400'
                      : isLight
                        ? 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-350'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}>
                    <button
                      onClick={() => handleLoadPreset(activeFlowchartPreset || 'flowchart')}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-l-xl transition-all duration-200 hover:bg-slate-500/10 active:scale-[0.98] cursor-pointer"
                      title="Load Flowchart Preset"
                    >
                      <span className="text-xs font-bold whitespace-nowrap">
                        {activeFlowchartPreset === 'workflow' ? 'Workflow' :
                         activeFlowchartPreset === 'decision' ? 'Decision Tree' :
                         activeFlowchartPreset === 'devops' ? 'DevOps Stack' : 'Flowchart'}
                      </span>
                    </button>
                    <div className={`w-px h-4.5 self-center ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                    <button
                      onClick={() => setIsFlowchartDropdownOpen(!isFlowchartDropdownOpen)}
                      className="px-2 py-1.5 rounded-r-xl transition-all duration-200 hover:bg-slate-500/10 active:scale-[0.98] cursor-pointer flex items-center justify-center"
                      title="Select Flowchart Template"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-355 ${isFlowchartDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isFlowchartDropdownOpen && (
                    <div className={`absolute left-0 top-full mt-2 w-56 rounded-xl border p-1.5 shadow-xl backdrop-blur-xl z-50 transition-all duration-250 ${isLight
                      ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/40'
                      : 'bg-slate-900/95 border-slate-800 text-slate-200 shadow-slate-950/80'
                      }`}>
                      <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                        Flowcharts & Trees
                      </div>
                      <button
                        onClick={() => {
                          handleLoadPreset('flowchart');
                          setIsFlowchartDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-start ${
                          code === PRESETS.flowchart
                            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600/15 text-indigo-300'
                            : isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="font-bold">Flowchart</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Standard top-down layout
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          handleLoadPreset('workflow');
                          setIsFlowchartDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-start mt-1 ${
                          code === PRESETS.workflow
                            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600/15 text-indigo-300'
                            : isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="font-bold">Workflow</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          User registration flow
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          handleLoadPreset('decision');
                          setIsFlowchartDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-start mt-1 ${
                          code === PRESETS.decision
                            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600/15 text-indigo-300'
                            : isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="font-bold">Decision Tree</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Offline recovery branching
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          handleLoadPreset('devops');
                          setIsFlowchartDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-start mt-1 ${
                          code === PRESETS.devops
                            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600/15 text-indigo-300'
                            : isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="font-bold">DevOps Stack</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Infrastructure architecture
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Sequence Group */}
                <div className="relative flex items-center sequence-dropdown-container">
                  <div className={`flex items-center rounded-xl border shadow-sm transition-all duration-300 ${
                    activeSequencePreset
                      ? isLight
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 hover:border-indigo-600'
                        : 'bg-indigo-600/15 border-indigo-500 text-indigo-300 hover:border-indigo-400'
                      : isLight
                        ? 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-350'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}>
                    <button
                      onClick={() => handleLoadPreset(activeSequencePreset || 'sequence')}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-l-xl transition-all duration-200 hover:bg-slate-500/10 active:scale-[0.98] cursor-pointer"
                      title="Load Sequence Diagram Preset"
                    >
                      <span className="text-xs font-bold whitespace-nowrap">
                        {activeSequencePreset === 'sequence_auth' ? 'OAuth Flow' :
                         activeSequencePreset === 'sequence_db' ? 'DB Query Flow' : 'Sequence Diagram'}
                      </span>
                    </button>
                    <div className={`w-px h-4.5 self-center ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                    <button
                      onClick={() => setIsSequenceDropdownOpen(!isSequenceDropdownOpen)}
                      className="px-2 py-1.5 rounded-r-xl transition-all duration-200 hover:bg-slate-500/10 active:scale-[0.98] cursor-pointer flex items-center justify-center"
                      title="Select Sequence Template"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-355 ${isSequenceDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isSequenceDropdownOpen && (
                    <div className={`absolute left-0 top-full mt-2 w-56 rounded-xl border p-1.5 shadow-xl backdrop-blur-xl z-50 transition-all duration-250 ${isLight
                      ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/40'
                      : 'bg-slate-900/95 border-slate-800 text-slate-200 shadow-slate-950/80'
                      }`}>
                      <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                        Sequence Diagrams
                      </div>
                      <button
                        onClick={() => {
                          handleLoadPreset('sequence');
                          setIsSequenceDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-start ${
                          code === PRESETS.sequence
                            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600/15 text-indigo-300'
                            : isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="font-bold">Standard Interaction</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Basic message passing
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          handleLoadPreset('sequence_auth');
                          setIsSequenceDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-start mt-1 ${
                          code === PRESETS.sequence_auth
                            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600/15 text-indigo-300'
                            : isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="font-bold">OAuth Flow</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          User auth authorization code
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          handleLoadPreset('sequence_db');
                          setIsSequenceDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex flex-col items-start mt-1 ${
                          code === PRESETS.sequence_db
                            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600/15 text-indigo-300'
                            : isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="font-bold">DB Query Flow</span>
                        <span className={`text-[10px] font-normal mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          API to database & cache checks
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}


          {/* Theme & Help Buttons */}
          <div className={`w-px h-6 transition-colors duration-300 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

          <a
            href="https://github.com/tra-sco/mermify"
            target="_blank"
            rel="noopener noreferrer"
            className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center justify-center ${isLight
              ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200 shadow-sm'
              : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800 shadow-md'
              }`}
            title="GitHub Repository"
            data-testid="github-link"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4.5 h-4.5"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </a>

          <button
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${isLight
              ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200 shadow-sm'
              : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800 shadow-md'
              }`}
            title={isLight ? 'Toggle Dark Mode' : 'Toggle Light Mode'}
          >
            {isLight ? (
              <Moon className="w-4.5 h-4.5" />
            ) : (
              <Sun className="w-4.5 h-4.5" />
            )}
          </button>

          <div className="relative flex items-center tour-dropdown-container">
            <div className={`flex items-center rounded-xl border shadow-md transition-all duration-300 ${isLight
              ? 'bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-350'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}>
              <button
                onClick={() => {
                  setIsTourDropdownOpen(false);
                  window.dispatchEvent(new CustomEvent('mermify-relaunch-tour', { detail: { type: 'full' } }));
                }}
                className="flex items-center space-x-1.5 pl-3 pr-2.5 py-1.5 rounded-l-xl transition-all duration-200 hover:bg-slate-500/10 active:scale-[0.98] cursor-pointer"
                title="Start Full Interactive Tour"
                data-testid="tour-relaunch-btn"
              >
                <HelpCircle className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold whitespace-nowrap">Tour</span>
              </button>

              <div className={`w-px h-4.5 self-center ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

              <button
                onClick={() => setIsTourDropdownOpen(!isTourDropdownOpen)}
                className="pl-2 pr-2.5 py-1.5 rounded-r-xl transition-all duration-200 hover:bg-slate-500/10 active:scale-[0.98] cursor-pointer flex items-center justify-center"
                title="Select Tour Version"
                data-testid="tour-dropdown-btn"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-355 ${isTourDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isTourDropdownOpen && (
              <div
                className={`absolute right-0 top-full mt-2 w-64 rounded-xl border p-1.5 shadow-xl backdrop-blur-xl z-50 transition-all duration-250 ${isLight
                  ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/40'
                  : 'bg-slate-900/95 border-slate-800 text-slate-200 shadow-slate-950/80'
                  }`}
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-500 flex items-center justify-between">
                  <span>Available Tours</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-550/10 text-indigo-550 dark:text-indigo-400 text-[9px] font-bold border border-indigo-550/15">v{CURRENT_TOUR_VERSION}</span>
                </div>

                <button
                  onClick={() => {
                    setIsTourDropdownOpen(false);
                    window.dispatchEvent(new CustomEvent('mermify-relaunch-tour', { detail: { type: 'full' } }));
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-start space-x-2.5 mt-1 ${isLight
                    ? 'hover:bg-indigo-50 text-slate-800'
                    : 'hover:bg-slate-800/80 text-slate-200'
                    }`}
                >
                  <div className={`p-1.5 rounded-lg mt-0.5 ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/15 text-indigo-400'}`}>
                    <HelpCircle className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold block text-slate-800 dark:text-slate-100">Full Interactive Tour</span>
                    <span className={`text-[10px] font-normal mt-0.5 block leading-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Complete 7-step onboarding to master Mermify features.
                    </span>
                  </div>
                </button>

                {UPDATE_TOURS.map((tour) => (
                  <button
                    key={tour.version}
                    onClick={() => {
                      setIsTourDropdownOpen(false);
                      window.dispatchEvent(new CustomEvent('mermify-relaunch-tour', { detail: { type: tour.version } }));
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-start space-x-2.5 mt-1 ${isLight
                      ? 'hover:bg-indigo-50 text-slate-800'
                      : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                  >
                    <div className={`p-1.5 rounded-lg mt-0.5 ${isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/15 text-amber-400'}`}>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold block text-slate-800 dark:text-slate-100">{tour.title}</span>
                      <span className={`text-[10px] font-normal mt-0.5 block leading-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Highlighting new changes in {tour.version}.
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Two-Panel Workspace Grid */}
      <main className={`flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 min-h-0 transition-colors duration-300 ${isLight ? 'bg-slate-100/50' : 'bg-slate-950'
        }`}>

        {/* Editor Area (Left Pane) */}
        <div className="h-full flex flex-col min-h-0 relative lg:col-span-1" data-testid="editor-pane">
          <Editor
            code={code}
            onChange={(val) => updateCode(val, false)}
            error={error}
            onReset={() => handleLoadPreset('workflow')}
            theme={theme}
            onMount={() => setIsEditorMounted(true)}
          />
        </div>

        {/* Visual Preview Canvas Area (Right Pane) */}
        <div className="h-full flex flex-col min-h-0 relative lg:col-span-2" data-testid="preview-pane">
          <Preview
            code={debouncedCode}
            onError={setError}
            onEditNode={setEditingNode}
            activeNode={editingNode}
            onNodeLabelChange={handleNodeLabelChange}
            onNodeShapeChange={handleNodeShapeChange}
            onDeleteNode={handleDeleteNodeById}
            onAddNodeClick={handleAddNode}
            onNodesParsed={handleNodesParsed}
            onDeleteEdge={handleDeleteConnectionByEnds}
            onEdgeLabelChange={handleEdgeLabelChangeInline}
            onEdgeStyleChange={handleEdgeStyleChangeInline}
            onConnectNodes={(sourceId, targetId) => {
              const updatedCode = addNodeConnection(code, sourceId, targetId, '-->', '');
              updateCode(updatedCode, true);
            }}
            onConnectNewNode={handleConnectNewNode}
            newNodeIdToEdit={newNodeIdToEdit}
            onClearNewNodeIdToEdit={() => setNewNodeIdToEdit(null)}
            onAddParticipant={handleAddParticipant}
            onUpdateParticipant={handleUpdateParticipant}
            onDeleteParticipant={handleDeleteParticipant}
            onReorderParticipants={handleReorderParticipants}
            onAddMessage={handleAddMessage}
            onUpdateMessage={handleUpdateMessage}
            onUpdateMessageConnection={handleUpdateMessageConnection}
            onReverseMessage={handleReverseMessage}
            onDeleteMessage={handleDeleteMessage}
            onToggleAutonumber={handleToggleAutonumber}
            theme={theme}
          />
        </div>
      </main>

      {/* Getting Started Tour Component */}
      <TourManager theme={theme} />
    </div>
  );
}
