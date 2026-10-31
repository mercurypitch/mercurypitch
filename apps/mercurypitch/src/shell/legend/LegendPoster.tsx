// ============================================================
// LegendPoster — the line at the door, before anyone sings it
// ============================================================
//
// A bead at each note's start, on a row for its pitch, and one lit thread
// through them, held flat for as long as each note lasts (posterView in
// legend-lane.ts). While the line plays, the bead of the note sounding
// lights and rings once, so the eye follows the ear.

import type { JSX } from 'solid-js'
import { createUniqueId, Index } from 'solid-js'
import type { PosterView, StageBox } from './legend-lane'

export interface LegendPosterProps {
  view: PosterView
  box: StageBox
  /** The note sounding while the line plays, or null. */
  sounding: () => number | null
  /** What the poster shows, for a screen reader. */
  summary: string
}

export function LegendPoster(props: LegendPosterProps): JSX.Element {
  const id = createUniqueId()
  return (
    <svg
      class="mp-legend-poster"
      width={props.box.width}
      height={props.box.height}
      viewBox={`0 0 ${props.box.width} ${props.box.height}`}
      role="img"
      aria-label={props.summary}
      data-testid="legend-poster"
    >
      <defs>
        <linearGradient
          id={`${id}-thread`}
          x1={props.view.from}
          y1="0"
          x2={props.view.to}
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#9a87f0" />
          <stop offset="1" stop-color="#7fdcf5" />
        </linearGradient>
        <radialGradient id={`${id}-orb`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="0.34" stop-color="#b8a8ff" />
          <stop offset="1" stop-color="#6f8dff" stop-opacity="0.92" />
        </radialGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#a493ff" stop-opacity="0.6" />
          <stop offset="1" stop-color="#a493ff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <Index each={props.view.rows}>
        {(row) => (
          <>
            <line
              class="mp-legend-poster__row"
              x1="52"
              x2={props.box.width - 20}
              y1={row().y}
              y2={row().y}
            />
            <text class="mp-legend-poster__name" x="18" y={row().y + 4.5}>
              {row().label}
            </text>
          </>
        )}
      </Index>
      <path
        class="mp-legend-poster__halo"
        d={props.view.thread}
        stroke={`url(#${id}-thread)`}
      />
      <path
        class="mp-legend-poster__thread"
        d={props.view.thread}
        stroke={`url(#${id}-thread)`}
      />
      <Index each={props.view.beads}>
        {(bead, index) => (
          <g
            class="mp-legend-poster__bead"
            data-on={props.sounding() === index ? 'true' : undefined}
          >
            <circle
              class="mp-legend-poster__glow"
              cx={bead().x}
              cy={bead().y}
              r="18"
              fill={`url(#${id}-glow)`}
            />
            <circle
              class="mp-legend-poster__ring"
              cx={bead().x}
              cy={bead().y}
              r="9"
            />
            <circle
              class="mp-legend-poster__orb"
              cx={bead().x}
              cy={bead().y}
              r="7"
              fill={`url(#${id}-orb)`}
            />
          </g>
        )}
      </Index>
    </svg>
  )
}
