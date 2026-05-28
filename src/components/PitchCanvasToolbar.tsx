// ============================================================
// PitchCanvasToolbar — toggle controls for the pitch canvas
// ============================================================

import type { Accessor, Component, Setter } from 'solid-js'

export interface PitchCanvasToolbarProps {
  showNoteLabels: Accessor<boolean>
  setShowNoteLabels: Setter<boolean>
}

export const PitchCanvasToolbar: Component<PitchCanvasToolbarProps> = (
  props,
) => {
  return (
    <div class="pitch-canvas-toolbar">
      <button
        class={`pitch-canvas-toggle${props.showNoteLabels() ? ' active' : ''}`}
        onClick={() => props.setShowNoteLabels((prev) => !prev)}
        title={props.showNoteLabels() ? 'Hide note labels' : 'Show note labels'}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
        <span>Note Labels</span>
      </button>
    </div>
  )
}
