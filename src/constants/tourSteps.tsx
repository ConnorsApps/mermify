import React from 'react';
import { DragConnectAnimation, ClickEditAnimation, DragSpawnAnimation } from '../components/TourAnimations';

export interface StepConfig {
  title: string;
  description: React.ReactNode;
  targetSelector?: string; // Empty means centered modal (no target)
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  animation?: React.ReactNode;
}

export const CURRENT_TOUR_VERSION = '0.3.0';

export const FULL_TOUR_STEPS: StepConfig[] = [
  {
    title: 'Welcome to Mermify! 🚀',
    description: (
      <>
        Mermify is a premium hybrid editor that combines real-time Mermaid markdown code editing with direct, visual interaction on the diagram. It now fully supports both <strong className="font-extrabold text-indigo-500">Flowcharts</strong> and <strong className="font-extrabold text-indigo-500">Sequence Diagrams</strong>! Let’s take a quick 1-minute tour to see how it works!
      </>
    ),
    position: 'center',
  },
  {
    title: 'Hybrid Code Editor ✍️',
    description: 'Write, edit, or copy Mermaid flowchart markdown here. The diagram on the right updates instantly as you type. If you make a syntax mistake, the built-in validator will guide you.',
    targetSelector: '[data-testid="editor-pane"]',
    position: 'right',
  },
  {
    title: 'Interactive Preview Canvas 🎨',
    description: 'Interact with the rendered diagram. You can click and drag to pan the canvas, or use the mouse wheel to zoom in and out. Press the "Fit" button to center your diagram.',
    targetSelector: '[data-testid="preview-pane"]',
    position: 'left',
  },
  {
    title: 'Drag to Connect Nodes 🔗',
    description: 'Hover over any node and drag the green socket at the bottom. Drop it onto another node to quickly link them together with a connection arrow.',
    targetSelector: '[data-testid="preview-pane"]',
    position: 'left',
    animation: <DragConnectAnimation />,
  },
  {
    title: 'Drag to Spawn New Nodes 🌿',
    description: 'Need to expand your flow? Drag the green socket from any node into empty canvas space and release. A new connected node will instantly spawn and open for editing!',
    targetSelector: '[data-testid="preview-pane"]',
    position: 'left',
    animation: <DragSpawnAnimation />,
  },
  {
    title: 'Double-Click or Click to Edit ✏️',
    description: 'Double-click any node or connection line to open the inline editor to rename it. A simple click opens the command palette to customize its shape/style, change arrows, or delete elements.',
    targetSelector: '[data-testid="preview-pane"]',
    position: 'left',
    animation: <ClickEditAnimation />,
  },
  {
    title: 'Export & Share 📤',
    description: 'Download your diagram as a high-quality SVG or PNG, copy the PNG image directly to your clipboard, or copy a compressed shareable URL to share your live workspace state.',
    targetSelector: '[data-testid="export-share-container"]',
    position: 'left',
  },
];

export interface UpdateTour {
  version: string;
  title: string;
  steps: StepConfig[];
}

export const UPDATE_TOURS: UpdateTour[] = [
  {
    version: '0.3.0',
    title: 'v0.3.0: Sequence Diagrams 📊',
    steps: [
      {
        title: 'New: Sequence Diagram Support! 📊',
        description: 'Mermify now fully supports interactive Sequence Diagrams! You can view and visually interact with sequence layouts right alongside flowcharts.',
        position: 'center',
      },
      {
        title: 'Interactive Sequence Canvas 🔄',
        description: 'Drag and drop participants to reorder them on the canvas, or double-click lines and messages to edit their labels on the fly.',
        targetSelector: '[data-testid="preview-pane"]',
        position: 'left',
      }
    ]
  }
];
