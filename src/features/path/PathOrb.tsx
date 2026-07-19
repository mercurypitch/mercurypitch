// ============================================================
// PathOrb — one celestial node of The Ascent (SVG)
// ============================================================
// Matches the concept render: a pearl-like orb wrapped by seven chunky
// dashed ring segments with rounded caps and a soft bloom. Lit segments
// count practice days; states recolour the pearl — locked (slate) /
// available (violet) / active (ice-cyan) / complete (gold + crown).
// Pure static SVG: no rAF, no canvas — headless- and print-safe.

import type { Component, JSX } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { DAYS_PER_WEEK } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import styles from './PathOrb.module.css'

export interface PathOrbProps {
  /** Lit ring segments, 0..7. */
  fill: number
  state: WeekState
  /** Outer diameter in px (ring included). */
  size?: number
  /** Show the n/7 fraction inside the orb. */
  showFraction?: boolean
}

// ── Ring geometry (precomputed once) ───────────────────────────
const VIEW = 120
const CX = 60
const CY = 60
const RING_R = 52
const SEG_COUNT = DAYS_PER_WEEK
const SEG_ANGLE = 360 / SEG_COUNT
const GAP_DEG = 13

function polar(angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + RING_R * Math.cos(rad), y: CY + RING_R * Math.sin(rad) }
}

/** Seven arc path strings, clockwise from 12 o'clock. */
const SEGMENTS: string[] = Array.from({ length: SEG_COUNT }, (_, i) => {
  const a0 = i * SEG_ANGLE + GAP_DEG / 2
  const a1 = (i + 1) * SEG_ANGLE - GAP_DEG / 2
  const p0 = polar(a0)
  const p1 = polar(a1)
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${RING_R} ${RING_R} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
})

interface Palette {
  /** Pearl body radial stops. */
  body: [string, string, string, string]
  /** Lit ring segment stroke. */
  lit: string
  /** Bloom colour behind lit segments / the orb. */
  glow: string
}

const PALETTES: Record<WeekState, Palette> = {
  complete: {
    body: ['#fff6dd', '#f0c674', '#a97e34', '#4c3714'],
    lit: '#f6d489',
    glow: 'rgba(240, 198, 116, 0.8)',
  },
  active: {
    body: ['#e9fbff', '#8fe4f2', '#2e7d99', '#123043'],
    lit: '#bdf3ff',
    glow: 'rgba(105, 220, 240, 0.85)',
  },
  available: {
    body: ['#d9d2ff', '#8d7bff', '#403a96', '#1a1838'],
    lit: '#b6a9ff',
    glow: 'rgba(129, 110, 250, 0.7)',
  },
  locked: {
    body: ['#4a4d6a', '#31344f', '#232540', '#15162a'],
    lit: '#9aa0c8',
    glow: 'rgba(0, 0, 0, 0)',
  },
}

export const PathOrb: Component<PathOrbProps> = (props) => {
  const uid = createUniqueId()
  const size = () => props.size ?? 104
  const pal = () => PALETTES[props.state]
  const lit = () =>
    props.state === 'complete'
      ? SEG_COUNT
      : Math.min(SEG_COUNT, Math.max(0, props.fill))

  const stateClass = () =>
    props.state === 'complete'
      ? styles.done
      : props.state === 'active'
        ? styles.active
        : props.state === 'available'
          ? styles.avail
          : styles.locked

  const svg = (): JSX.Element => (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={size()}
      height={size()}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`body-${uid}`} cx="36%" cy="30%" r="75%">
          <stop offset="0%" stop-color={pal().body[0]} />
          <stop offset="34%" stop-color={pal().body[1]} />
          <stop offset="74%" stop-color={pal().body[2]} />
          <stop offset="100%" stop-color={pal().body[3]} />
        </radialGradient>
        <radialGradient id={`halo-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stop-color={pal().glow} stop-opacity="0.55" />
          <stop offset="100%" stop-color={pal().glow} stop-opacity="0" />
        </radialGradient>
        <filter id={`blur-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
      </defs>

      {/* Ambient halo behind everything (invisible when locked). */}
      <circle cx={CX} cy={CY} r="58" fill={`url(#halo-${uid})`} />

      {/* Bloom pass under the lit segments. */}
      <Show when={lit() > 0 && props.state !== 'locked'}>
        <g
          filter={`url(#blur-${uid})`}
          stroke={pal().glow}
          stroke-width="9"
          stroke-linecap="round"
          fill="none"
          opacity="0.9"
        >
          <For each={SEGMENTS.slice(0, lit())}>{(d) => <path d={d} />}</For>
        </g>
      </Show>

      {/* Unlit ring segments. */}
      <g
        stroke="rgba(215, 219, 250, 0.16)"
        stroke-width="6.5"
        stroke-linecap="round"
        fill="none"
      >
        <For each={SEGMENTS.slice(lit())}>{(d) => <path d={d} />}</For>
      </g>

      {/* Lit ring segments. */}
      <g
        stroke={pal().lit}
        stroke-width="6.5"
        stroke-linecap="round"
        fill="none"
      >
        <For each={SEGMENTS.slice(0, lit())}>{(d) => <path d={d} />}</For>
      </g>

      {/* Pearl body. */}
      <circle cx={CX} cy={CY} r="36" fill={`url(#body-${uid})`} />
      {/* Specular highlight + low rim light. */}
      <ellipse
        cx="49"
        cy="46"
        rx="16"
        ry="11"
        fill="rgba(255,255,255,0.5)"
        filter={`url(#blur-${uid})`}
      />
      <path
        d="M 34 74 A 34 34 0 0 0 86 74"
        stroke="rgba(255,255,255,0.18)"
        stroke-width="3"
        stroke-linecap="round"
        fill="none"
        filter={`url(#blur-${uid})`}
      />
    </svg>
  )

  return (
    <div
      class={`${styles.wrap} ${stateClass()}`}
      style={{ width: `${size()}px`, height: `${size()}px` }}
      role="img"
      aria-label={`Week ${props.state === 'complete' ? 'complete' : `${props.fill} of ${DAYS_PER_WEEK} days`}`}
    >
      {svg()}
      <Show when={props.showFraction !== false}>
        <div class={styles.frac}>
          {props.state === 'complete' ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4.5 12.5l5 5 10-11" />
            </svg>
          ) : (
            `${props.fill}/${DAYS_PER_WEEK}`
          )}
        </div>
      </Show>
      <Show when={props.state === 'complete'}>
        <svg
          class={styles.crown}
          width="20"
          height="14"
          viewBox="0 0 20 14"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M2 12h16l1-8-5 4-4-7-4 7-5-4z" />
        </svg>
      </Show>
    </div>
  )
}
