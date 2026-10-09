// ============================================================
// Lantern — the storm lantern that fills with light
// ============================================================
//
// Two SVG layers in one view box (lantern-geometry.ts). The back layer holds
// the handle, the glass's far wall and the luminous liquid; the front layer
// holds what Merc floats BEHIND: a veil of the liquid over his feet, the
// glass's highlights, the frame and the cap. The room puts Merc's canvas
// between the two, so he reads as inside the glass.
//
// The liquid is teal at the bottom and violet at its surface whatever its
// height: the gradient is laid on the liquid's own box, not the chimney's.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './Lantern.module.css'
import { CHIMNEY_BOTTOM, CHIMNEY_PATH, LANTERN_VIEW_H, LANTERN_VIEW_W, surfaceY, TARGET_LINE_Y, } from './lantern-geometry'

export interface LanternProps {
  /** How full the liquid is, 0 to 1. */
  level: () => number
  /** How brightly it glows, 0 to 1: high while the note is on target. */
  glow: () => number
  /** The full lantern's halo and sparkles. */
  shining: () => boolean
}

const VIEW_BOX = `0 0 ${LANTERN_VIEW_W} ${LANTERN_VIEW_H}`

// The sparkles' places around the full lantern, in view-box units.
const SPARKLES = [
  { x: 28, y: 120, s: 1, d: 0 },
  { x: 176, y: 96, s: 0.8, d: 0.6 },
  { x: 182, y: 230, s: 1.1, d: 1.1 },
  { x: 20, y: 268, s: 0.7, d: 1.6 },
  { x: 100, y: 46, s: 0.6, d: 0.9 },
]

function LiquidGradients(props: { id: string }): JSX.Element {
  return (
    <>
      <linearGradient id={`${props.id}-liquid`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#04ecd8" />
        <stop offset="0.45" stop-color="#1f7fe3" />
        <stop offset="1" stop-color="#9b55f5" />
      </linearGradient>
      <clipPath id={`${props.id}-chimney`}>
        <path d={CHIMNEY_PATH} />
      </clipPath>
    </>
  )
}

let nextId = 0

/** The layer behind Merc: handle, far glass, liquid and its glow. */
export function LanternBack(props: LanternProps): JSX.Element {
  const id = `lantern-back-${nextId++}`
  const top = (): number => surfaceY(props.level())
  return (
    <svg
      class={styles.layer}
      viewBox={VIEW_BOX}
      aria-hidden="true"
      data-testid="lantern-back"
    >
      <defs>
        <LiquidGradients id={id} />
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stop-color="#9b8cff" stop-opacity="0.55" />
          <stop offset="0.55" stop-color="#3fb8f0" stop-opacity="0.18" />
          <stop offset="1" stop-color="#3fb8f0" stop-opacity="0" />
        </radialGradient>
        {/* In the lantern's own units: a region sized to the liquid would
            shrink with a low fill and cut the blur off in a hard edge. */}
        <filter
          id={`${id}-bloom`}
          filterUnits="userSpaceOnUse"
          x="-60"
          y="0"
          width="320"
          height="400"
        >
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#2a3040" />
          <stop offset="0.5" stop-color="#4b5468" />
          <stop offset="1" stop-color="#262b39" />
        </linearGradient>
      </defs>

      <ellipse
        class={styles.halo}
        classList={{ [styles.haloOn]: props.shining() }}
        cx="100"
        cy="214"
        rx="150"
        ry="210"
        fill={`url(#${id}-halo)`}
      />

      {/* The carry handle, a wire bail over the cap. */}
      <path
        d="M58 74 C58 8 142 8 142 74"
        fill="none"
        stroke={`url(#${id}-metal)`}
        stroke-width="5"
        stroke-linecap="round"
      />

      {/* The far wall of the glass. */}
      <path d={CHIMNEY_PATH} fill="rgba(160, 190, 255, 0.05)" />

      <g clip-path={`url(#${id}-chimney)`}>
        {/* The bloom: a blurred copy of the liquid, brighter on target. */}
        <rect
          x="30"
          y={top()}
          width="140"
          height={Math.max(0, CHIMNEY_BOTTOM - top() + 4)}
          fill={`url(#${id}-liquid)`}
          filter={`url(#${id}-bloom)`}
          opacity={0.35 + 0.65 * props.glow()}
        />
        <rect
          x="30"
          y={top()}
          width="140"
          height={Math.max(0, CHIMNEY_BOTTOM - top() + 4)}
          fill={`url(#${id}-liquid)`}
          opacity={0.78 + 0.22 * props.glow()}
        />
        {/* The surface: a slow wave of brighter light along the top. */}
        <g transform={`translate(0 ${top()})`}>
          <path
            class={styles.wave}
            d="M-200 0 q12.5 -3 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 V6 H-200 Z"
            fill="#d9c6ff"
            opacity={top() >= CHIMNEY_BOTTOM - 0.5 ? 0 : 0.55}
          />
        </g>
      </g>
    </svg>
  )
}

/** The layer in front of Merc: liquid veil, glass, frame, cap and base. */
export function LanternFront(props: LanternProps): JSX.Element {
  const id = `lantern-front-${nextId++}`
  const top = (): number => surfaceY(props.level())
  return (
    <svg
      class={styles.layer}
      viewBox={VIEW_BOX}
      aria-hidden="true"
      data-testid="lantern-front"
    >
      <defs>
        <LiquidGradients id={id} />
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#2a3040" />
          <stop offset="0.5" stop-color="#4b5468" />
          <stop offset="1" stop-color="#262b39" />
        </linearGradient>
        <linearGradient id={`${id}-dome`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#58627a" />
          <stop offset="1" stop-color="#252a37" />
        </linearGradient>
        <filter id={`${id}-soft`} x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* The liquid in front of Merc's feet: he floats IN it. */}
      <g clip-path={`url(#${id}-chimney)`}>
        <rect
          x="30"
          y={top() + 3}
          width="140"
          height={Math.max(0, CHIMNEY_BOTTOM - top())}
          fill={`url(#${id}-liquid)`}
          opacity={0.32}
        />
      </g>

      {/* The target line again, over the light once the light covers it:
          the canvas draws it behind the lantern, under the liquid. */}
      <Show when={top() <= TARGET_LINE_Y}>
        <line
          x1="30"
          x2="170"
          y1={TARGET_LINE_Y}
          y2={TARGET_LINE_Y}
          stroke="rgba(150, 205, 255, 0.6)"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
          clip-path={`url(#${id}-chimney)`}
        />
      </Show>

      {/* The glass: its rim and two highlights, the left one strong. */}
      <path
        d={CHIMNEY_PATH}
        fill="none"
        stroke="rgba(220, 232, 255, 0.28)"
        stroke-width="1.6"
      />
      <path
        d="M66 104 C55 160 54 262 66 322"
        fill="none"
        stroke="rgba(255, 255, 255, 0.55)"
        stroke-width="4"
        stroke-linecap="round"
        filter={`url(#${id}-soft)`}
      />
      <path
        d="M136 112 C146 170 146 250 137 312"
        fill="none"
        stroke="rgba(255, 255, 255, 0.16)"
        stroke-width="2.5"
        stroke-linecap="round"
      />

      {/* The frame: two guards down the sides and a ring at each end. */}
      <path
        d="M52 88 C38 150 36 282 50 340"
        fill="none"
        stroke={`url(#${id}-metal)`}
        stroke-width="4.5"
        stroke-linecap="round"
      />
      <path
        d="M148 88 C162 150 164 282 150 340"
        fill="none"
        stroke={`url(#${id}-metal)`}
        stroke-width="4.5"
        stroke-linecap="round"
      />
      <rect
        x="48"
        y="80"
        width="104"
        height="13"
        rx="4"
        fill={`url(#${id}-metal)`}
      />

      {/* The domed cap, vented, with its finial. */}
      <path
        d="M56 82 C56 50 76 40 100 40 C124 40 144 50 144 82 Z"
        fill={`url(#${id}-dome)`}
      />
      <path
        d="M70 70 H130 M74 60 H126"
        stroke="rgba(10, 12, 20, 0.55)"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="100" cy="36" r="6" fill="#4b5468" />

      {/* The base: the tank and its foot. */}
      <rect
        x="44"
        y="334"
        width="112"
        height="30"
        rx="8"
        fill={`url(#${id}-metal)`}
      />
      <rect x="36" y="360" width="128" height="10" rx="5" fill="#1d212c" />
      <path
        d="M52 342 H148"
        stroke="rgba(255, 255, 255, 0.12)"
        stroke-width="2"
        stroke-linecap="round"
      />

      <Show when={props.shining()}>
        <g class={styles.sparkles}>
          <For each={SPARKLES}>
            {(spark) => (
              <path
                class={styles.sparkle}
                style={{ 'animation-delay': `${spark.d}s` }}
                transform={`translate(${spark.x} ${spark.y}) scale(${spark.s})`}
                d="M0 -9 C1 -2 2 -1 9 0 C2 1 1 2 0 9 C-1 2 -2 1 -9 0 C-2 -1 -1 -2 0 -9 Z"
                fill="#f3eaff"
              />
            )}
          </For>
        </g>
      </Show>
    </svg>
  )
}
