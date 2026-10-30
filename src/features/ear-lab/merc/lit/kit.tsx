// ============================================================
// The lit kit: what every lit instrument is drawn with. Gradients in
// the station's light across and down the stage, glass, an orb and a
// lens; a lit stroke (a wide faint halo under a thin bright core); an
// orb with its glow; and a ring that swells and fades as a sound starts.
// ============================================================

import type { JSX } from 'solid-js'
import { createUniqueId, Show } from 'solid-js'
import { easeOut, tenth } from './draw'
import styles from './lit.module.css'

/** The stage's width in the drawing's own units, as wide as a phone. */
export const STAGE_W = 390

export const WHITE = '#eef0ff'
export const TEAL = '#2ee6c9'
export const TEAL_PALE = '#8ff5e3'
export const RED = '#ff6a5c'

/** The ids of an instrument's gradients, one set per instrument. */
export interface LitIds {
  /** Across the stage, the station's two lights. */
  across: string
  /** Down the stage. */
  down: string
  glass: string
  orb: string
  orbTeal: string
  glow: string
  glowTeal: string
  lens: string
}

export function litIds(): LitIds {
  const base = `lit-${createUniqueId()}`
  return {
    across: `${base}-across`,
    down: `${base}-down`,
    glass: `${base}-glass`,
    orb: `${base}-orb`,
    orbTeal: `${base}-orb-teal`,
    glow: `${base}-glow`,
    glowTeal: `${base}-glow-teal`,
    lens: `${base}-lens`,
  }
}

export const paint = (id: string): string => `url(#${id})`

/** The gradients `ids` names, for a stage `height` units tall. */
export function LitDefs(props: { ids: LitIds; height: number }): JSX.Element {
  return (
    <defs>
      <linearGradient
        id={props.ids.across}
        x1="0"
        y1="0"
        x2={STAGE_W}
        y2="0"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" class={styles.stopA} />
        <stop offset="1" class={styles.stopB} />
      </linearGradient>
      <linearGradient
        id={props.ids.down}
        x1="0"
        y1="0"
        x2="0"
        y2={props.height}
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" class={styles.stopA} />
        <stop offset="1" class={styles.stopB} />
      </linearGradient>
      <linearGradient id={props.ids.glass} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.075" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.02" />
      </linearGradient>
      <radialGradient id={props.ids.orb} cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.95" />
        <stop offset="0.34" class={styles.stopA} />
        <stop offset="1" class={styles.stopB} stop-opacity="0.92" />
      </radialGradient>
      <radialGradient id={props.ids.orbTeal} cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.95" />
        <stop offset="0.36" stop-color={TEAL} />
        <stop offset="1" stop-color="#13917f" stop-opacity="0.92" />
      </radialGradient>
      <radialGradient id={props.ids.glow} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" class={styles.stopA} stop-opacity="0.55" />
        <stop offset="1" class={styles.stopA} stop-opacity="0" />
      </radialGradient>
      <radialGradient id={props.ids.glowTeal} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color={TEAL} stop-opacity="0.5" />
        <stop offset="1" stop-color={TEAL} stop-opacity="0" />
      </radialGradient>
      <radialGradient id={props.ids.lens} cx="0.42" cy="0.34" r="0.72">
        <stop offset="0" stop-color="#18224f" />
        <stop offset="0.68" stop-color="#0a1029" />
        <stop offset="1" stop-color="#060a1c" />
      </radialGradient>
    </defs>
  )
}

/** A lit stroke along `d`: a wide faint halo under a thin bright core. */
export function Glow(props: {
  d: string
  width: number
  stroke: string
  opacity?: number
  dash?: string
}): JSX.Element {
  return (
    <g class={styles.glow} style={{ opacity: props.opacity ?? 1 }}>
      <path
        class={styles.halo}
        d={props.d}
        stroke={props.stroke}
        stroke-width={tenth(props.width * 4)}
      />
      <path
        d={props.d}
        stroke={props.stroke}
        stroke-width={props.width}
        stroke-dasharray={props.dash}
      />
    </g>
  )
}

/** A lit orb at (x, y): its glow, then its body, teal once it is the
 *  answer. */
export function Orb(props: {
  ids: LitIds
  x: number
  y: number
  r: number
  teal?: boolean
  /** The body's light, 0 to 1. */
  lit?: number
  /** The glow around it, 0 to 1. */
  glow?: number
}): JSX.Element {
  return (
    <g transform={`translate(${tenth(props.x)} ${tenth(props.y)})`}>
      <circle
        r={tenth(props.r * 2.3)}
        fill={paint(props.teal === true ? props.ids.glowTeal : props.ids.glow)}
        opacity={props.glow ?? 0.2}
      />
      <circle
        r={props.r}
        fill={paint(props.teal === true ? props.ids.orbTeal : props.ids.orb)}
        opacity={props.lit ?? 1}
      />
    </g>
  )
}

/**
 * A ring that swells from `from` to `to` px and fades as a sound starts:
 * `t` ms since it began, over `ms`. Nothing before it starts or once it
 * has faded.
 */
export function Ring(props: {
  x: number
  y: number
  t: number
  ms: number
  from: number
  to: number
  stroke?: string
  width?: number
}): JSX.Element {
  const p = (): number => props.t / props.ms
  return (
    <Show when={p() > 0 && p() < 1}>
      <circle
        cx={tenth(props.x)}
        cy={tenth(props.y)}
        r={tenth(props.from + (props.to - props.from) * easeOut(p()))}
        fill="none"
        stroke={props.stroke ?? 'var(--room-a, #9a87f0)'}
        stroke-width={props.width ?? 2}
        opacity={tenth((1 - p()) * 0.85 * 10) / 10}
      />
    </Show>
  )
}
