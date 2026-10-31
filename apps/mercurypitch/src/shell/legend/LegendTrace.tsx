// ============================================================
// LegendTrace — a take of the Legend, the whole of it at once
// ============================================================
//
// The result's small picture of the take: every note of the line, teal
// when it was lit and red with a cross when it was missed, and the voice
// over them (traceView in legend-lane.ts). The words under it, in the
// room, say how many were lit and which way a miss went.

import type { JSX } from 'solid-js'
import { createUniqueId, Index, Show } from 'solid-js'
import type { StageBox, TraceView } from './legend-lane'

export interface LegendTraceProps {
  view: TraceView
  box: StageBox
  /** What the trace shows, for a screen reader. */
  summary: string
}

const NOTE_H = 10

export function LegendTrace(props: LegendTraceProps): JSX.Element {
  const id = createUniqueId()
  return (
    <svg
      class="mp-legend-trace"
      width={props.box.width}
      height={props.box.height}
      viewBox={`0 0 ${props.box.width} ${props.box.height}`}
      role="img"
      aria-label={props.summary}
      data-testid="legend-trace"
    >
      <defs>
        <linearGradient id={`${id}-teal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2ee6c9" stop-opacity="0.55" />
          <stop offset="1" stop-color="#13917f" stop-opacity="0.4" />
        </linearGradient>
        <linearGradient
          id={`${id}-voice`}
          x1="0"
          y1="0"
          x2={props.box.width}
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#7fdcf5" stop-opacity="0.75" />
          <stop offset="1" stop-color="#c9f6ff" />
        </linearGradient>
      </defs>
      <Index each={props.view.rows}>
        {(row) => (
          <line
            class="mp-legend-trace__row"
            x1="0"
            x2={props.box.width}
            y1={row().y}
            y2={row().y}
          />
        )}
      </Index>
      <Index each={props.view.notes}>
        {(note) => (
          <rect
            class="mp-legend-trace__note"
            data-look={note().look}
            x={note().x}
            y={note().y - NOTE_H / 2}
            width={note().width}
            height={NOTE_H}
            rx={NOTE_H / 2}
            fill={note().look === 'lit' ? `url(#${id}-teal)` : undefined}
          />
        )}
      </Index>
      <Show when={props.view.voice !== ''}>
        <path
          class="mp-legend-trace__voice"
          d={props.view.voice}
          stroke={`url(#${id}-voice)`}
        />
      </Show>
      <Index each={props.view.notes}>
        {(note) => (
          <Show when={note().look === 'missed'}>
            <g class="mp-legend-trace__miss">
              <circle
                cx={note().x + note().width - 1}
                cy={note().y - NOTE_H / 2 - 1}
                r="6.5"
              />
              <path
                d={`M${note().x + note().width - 3.2} ${note().y - NOTE_H / 2 - 3.2}l4.4 4.4M${note().x + note().width + 1.2} ${note().y - NOTE_H / 2 - 3.2}l-4.4 4.4`}
              />
            </g>
          </Show>
        )}
      </Index>
    </svg>
  )
}
