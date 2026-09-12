// ============================================================
// The trace when there is nothing to draw — silent, and demo
// ============================================================
//
// Two of the room's states have no voice to show and still have to show a
// line, because the line is what the room is: R0/R1 rest under a dashed
// silent trace ("the path opens on a silent trace and asks for nothing"),
// and the denied state draws a pre-recorded demo line, labelled as one so
// nobody mistakes it for their own (3d, and Apple 5.1.1(iv)).
//
// SVG rather than the canvas: neither of these moves, neither needs a frame
// loop, and the kit draws both as paths. The live trace is the canvas's.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './sing-room.module.css'

/** The rows the two static traces are drawn against. */
const GRID = [
  { y: 35, label: 'B3' },
  { y: 70, label: 'A3' },
  { y: 105, label: 'G3' },
]

/** Flat down the middle: a line waiting for a voice, not pretending to have one. */
const SILENT_PATH = 'M6 70C60 70 120 70 180 70S300 70 347 70'

/** The mock's own demo line, note for note (3d). */
const DEMO_PATH =
  'M6 112C40 110 60 78 90 74S150 92 180 82 240 58 270 66 330 76 347 70'

interface SingTraceProps {
  variant: 'silent' | 'demo'
  /** Labels are drawn for the demo line, which claims to show real notes. */
  labelled?: boolean
}

export const SingTrace: Component<SingTraceProps> = (props) => (
  <svg
    class={styles.trace}
    viewBox="0 0 353 140"
    preserveAspectRatio="none"
    role="img"
    aria-label={
      props.variant === 'silent'
        ? 'Silent pitch trace, waiting for your first note. The microphone is off.'
        : 'Demo pitch trace, pre-recorded. The microphone is off.'
    }
    data-testid={`sing-trace-${props.variant}`}
  >
    <g class={styles.traceGrid}>
      <For each={GRID}>
        {(row) => (
          <>
            <line x1="0" x2="353" y1={row.y} y2={row.y} />
            <Show when={props.labelled === true}>
              <text x="4" y={row.y - 4}>
                {row.label}
              </text>
            </Show>
          </>
        )}
      </For>
    </g>
    <Show when={props.variant === 'demo'}>
      <path class={styles.traceTarget} d="M0 70H353" />
    </Show>
    <path
      class={props.variant === 'silent' ? styles.traceSilent : styles.traceDemo}
      d={props.variant === 'silent' ? SILENT_PATH : DEMO_PATH}
    />
  </svg>
)

/**
 * The priming screen's illustration: a dotted grey line waking into a
 * coloured one. Drawn, not live — there is no microphone yet.
 */
export const SingPrimingArt: Component = () => (
  <svg
    class={styles.primingArt}
    viewBox="0 0 353 250"
    role="img"
    aria-label="Illustration: a dotted grey line wakes into a coloured pitch line that rises to the right"
  >
    <defs>
      <linearGradient id="sing-priming-spectrum" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#58a6ff" />
        <stop offset="0.5" stop-color="#2dd4bf" />
        <stop offset="1" stop-color="#bc8cff" />
      </linearGradient>
      <radialGradient id="sing-priming-glow" cx="0.72" cy="0.4" r="0.5">
        <stop offset="0" stop-color="#2dd4bf" stop-opacity="0.2" />
        <stop offset="1" stop-color="#2dd4bf" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="353" height="250" fill="url(#sing-priming-glow)" />
    <g stroke="rgba(230,237,243,0.08)" stroke-width="1">
      <line x1="0" x2="353" y1="62" y2="62" />
      <line x1="0" x2="353" y1="125" y2="125" />
      <line x1="0" x2="353" y1="188" y2="188" />
    </g>
    <path
      d="M10 156C40 156 70 156 100 156S140 156 166 156"
      fill="none"
      stroke="rgba(230,237,243,0.22)"
      stroke-width="3"
      stroke-linecap="round"
      stroke-dasharray="1 7"
    />
    <path
      d="M166 156C186 156 198 128 220 110S256 134 282 116 318 74 344 64"
      fill="none"
      stroke="url(#sing-priming-spectrum)"
      stroke-width="3.5"
      stroke-linecap="round"
    />
    <g fill="#e6edf3">
      <circle cx="220" cy="110" r="2.5" />
      <circle cx="282" cy="116" r="2.5" />
    </g>
    <circle cx="344" cy="64" r="5" fill="#ffffff" />
  </svg>
)
