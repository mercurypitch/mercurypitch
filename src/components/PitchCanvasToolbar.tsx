// ============================================================
// PitchCanvasToolbar — toggle controls for the pitch canvas
// ============================================================

import type { Accessor, Component, Setter } from 'solid-js'
import { Show } from 'solid-js'

export interface PitchCanvasToolbarProps {
  showNoteLabels: Accessor<boolean>
  setShowNoteLabels: Setter<boolean>
  showLyricLabels: Accessor<boolean>
  setShowLyricLabels: Setter<boolean>
  // Mic-related toggles — only present in the StemMixer's Vocal Pitch panel.
  showMicLine?: Accessor<boolean>
  setShowMicLine?: Setter<boolean>
  showUserNoteLabels?: Accessor<boolean>
  setShowUserNoteLabels?: Setter<boolean>
  // Melody audio — sounds the detected notes during playback (StemMixer only).
  melodyAudio?: Accessor<boolean>
  onToggleMelodyAudio?: () => void
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
          fill="currentColor"
          stroke="none"
        >
          {/* Eighth note (quaver) */}
          <ellipse cx="7" cy="19" rx="4" ry="3" />
          <rect x="10" y="4" width="2.5" height="15" rx="1" />
          <path d="M12.5 4 C14 4, 19 3, 20 8 C21 12, 17 11, 12.5 10 Z" />
        </svg>
        <span>Note Labels</span>
      </button>
      <button
        class={`pitch-canvas-toggle${props.showLyricLabels() ? ' active' : ''}`}
        onClick={() => props.setShowLyricLabels((prev) => !prev)}
        title={
          props.showLyricLabels() ? 'Hide lyric labels' : 'Show lyric labels'
        }
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
          <path d="M3 5h12" />
          <path d="M3 12h8" />
          <path d="M3 19h14" />
          <path d="M18 9l3 3-3 3" />
        </svg>
        <span>Lyric Labels</span>
      </button>
      <Show when={props.onToggleMelodyAudio}>
        <button
          class={`pitch-canvas-toggle${props.melodyAudio?.() === true ? ' active' : ''}`}
          onClick={() => props.onToggleMelodyAudio?.()}
          title={
            props.melodyAudio?.() === true
              ? 'Mute the detected melody'
              : 'Hear the detected melody as notes during playback'
          }
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
            <polygon
              points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
              fill="currentColor"
              stroke="none"
            />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
          <span>Melody</span>
        </button>
      </Show>
      <Show when={props.setShowMicLine}>
        <button
          class={`pitch-canvas-toggle${props.showMicLine?.() === true ? ' active' : ''}`}
          onClick={() => props.setShowMicLine?.((prev) => !prev)}
          title={
            props.showMicLine?.() === true
              ? 'Hide your mic pitch line'
              : 'Show your mic pitch line (red)'
          }
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ff6b8a"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 14l4-5 4 4 4-8 4 6 4-3" />
          </svg>
          <span>My Pitch</span>
        </button>
      </Show>
      <Show when={props.setShowUserNoteLabels}>
        <button
          class={`pitch-canvas-toggle${props.showUserNoteLabels?.() === true ? ' active' : ''}`}
          onClick={() => props.setShowUserNoteLabels?.((prev) => !prev)}
          title={
            props.showUserNoteLabels?.() === true
              ? 'Hide the notes you sang'
              : 'Show the notes you sang on your outlines'
          }
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="#ff6b8a"
            stroke="none"
          >
            <ellipse cx="7" cy="19" rx="4" ry="3" />
            <rect x="10" y="4" width="2.5" height="15" rx="1" />
            <path d="M12.5 4 C14 4, 19 3, 20 8 C21 12, 17 11, 12.5 10 Z" />
          </svg>
          <span>My Notes</span>
        </button>
      </Show>
    </div>
  )
}
