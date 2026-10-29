// ============================================================
// Hairline's loupe, upright, as the room draws it (ROOM_SKIN).
//
// The cents scale stands on its end, higher on screen for higher in
// pitch, with the two tones as two level hairlines across it, and the
// glass beside it magnifying the same two. While the tones sound and
// the answer is due, the lines stand evenly about the middle, alike and
// unnamed: the gap shows, which way it went does not, and the pads'
// lamps say which tone is sounding. At the reveal the higher line is
// named in the pads' words, and the glass says how far it magnifies.
//
// The glass magnifies by a whole number, the most up to x12 that keeps
// the two lines in its middle band with its words above and below.
// Past about 104 cents even x1 does not; there the lines stand where
// they are and the words move in between them.
// ============================================================

import type { JSX } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import type { VernierLoupeProps } from '@/features/ear-lab/VernierLoupe'
import styles from './loupe.module.css'

const WIDTH = 370
const HEIGHT = 236
const MID_Y = 118
/** Px per cent, on the rail and in the glass at x1. */
const PX_PER_CENT = 0.96
/** The rail's reach either way, in cents. */
const REACH = 100
const RAIL_X = 318
const TICKS = Array.from({ length: 21 }, (_, i) => -REACH + i * 10)

const GLASS_X = 176
const GLASS_R = 102
/** How far the two lines may stand apart in the glass with its words
 *  clear of them. */
const BAND = 100
const MOST = 12

/** How far the glass magnifies a gap: a whole number, 1 to 12. */
export function loupeMagnification(gap: number): number {
  const span = Math.max(gap, 0.01) * PX_PER_CENT
  return Math.max(1, Math.min(MOST, Math.floor(BAND / span)))
}

/** Where a chord of the glass meets its rim, `dy` from its middle. */
function rimX(dy: number): number {
  const r = GLASS_R - 2
  return GLASS_X + Math.sqrt(Math.max(0, r * r - dy * dy))
}

const railY = (cents: number): number => MID_Y - cents * PX_PER_CENT

export function RoomLoupe(props: VernierLoupeProps): JSX.Element {
  const clip = `merc-loupe-clip-${createUniqueId()}`
  const shine = `merc-loupe-shine-${createUniqueId()}`

  const gap = () => Math.max(0, props.gap)
  const magnification = () => loupeMagnification(gap())
  /** Each line's distance from the middle: on the rail, whose ends hold
   *  the widest, and in the glass. */
  const onRail = () => Math.min(REACH, gap() / 2) * PX_PER_CENT
  const inGlass = () => (gap() / 2) * PX_PER_CENT * magnification()
  /** Only at x1, past about 104 cents: the words go in between. */
  const wide = () => inGlass() * 2 > BAND

  const readout = () => `${gap().toFixed(1)}¢`
  const higherName = () =>
    props.reveal === 'first' ? 'The first' : 'The second'
  const label = () =>
    `An upright scale under a loupe: two hairlines ${readout()} apart${
      props.reveal === null
        ? ''
        : `, magnified ${magnification()} times, the ${props.reveal} tone higher`
    }`

  /** The name beside the higher line, level with it; with the lines
   *  close, a little above both, so it names the upper one. Past x1's
   *  band, just under it. */
  const tagY = () =>
    wide() ? MID_Y - inGlass() + 20 : MID_Y - Math.max(inGlass(), 9)

  const shift = (dy: number): JSX.CSSProperties => ({
    transform: `translateY(${dy}px)`,
  })

  return (
    <svg
      class={styles.loupe}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="upright-loupe"
      data-magnification={magnification()}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx={GLASS_X} cy={MID_Y} r={GLASS_R - 2} />
        </clipPath>
        <radialGradient id={shine} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.06" />
          <stop offset="0.85" stop-color="#ffffff" stop-opacity="0.02" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0.16" />
        </radialGradient>
      </defs>

      {/* The scale on its end, ticked every 10 cents. */}
      <line
        x1={RAIL_X}
        x2={RAIL_X}
        y1={railY(REACH)}
        y2={railY(-REACH)}
        class={styles.rail}
      />
      <For each={TICKS}>
        {(cents) => (
          <line
            x1={RAIL_X - (cents % 50 === 0 ? 12 : 7)}
            x2={RAIL_X}
            y1={railY(cents)}
            y2={railY(cents)}
            class={styles.tick}
            classList={{ [styles.tickMajor]: cents % 50 === 0 }}
          />
        )}
      </For>
      <text
        x={RAIL_X + 12}
        y={railY(50)}
        class={styles.caption}
        dominant-baseline="central"
      >
        +50¢
      </text>
      <text
        x={RAIL_X + 12}
        y={railY(0)}
        class={styles.caption}
        dominant-baseline="central"
      >
        0
      </text>
      <text
        x={RAIL_X + 12}
        y={railY(-50)}
        class={styles.caption}
        dominant-baseline="central"
      >
        −50¢
      </text>

      {/* From each line on the rail to the same line in the glass. */}
      <line
        x1={RAIL_X - 18}
        y1={MID_Y - onRail()}
        x2={rimX(inGlass())}
        y2={MID_Y - inGlass()}
        class={styles.lead}
      />
      <line
        x1={RAIL_X - 18}
        y1={MID_Y + onRail()}
        x2={rimX(inGlass())}
        y2={MID_Y + inGlass()}
        class={styles.lead}
      />

      <g class={styles.mover} style={shift(-onRail())}>
        <line
          x1={RAIL_X - 18}
          x2={RAIL_X + 5}
          y1={MID_Y}
          y2={MID_Y}
          class={styles.hair}
          classList={{ [styles.higher]: props.reveal !== null }}
          data-line="upper"
        />
      </g>
      <g class={styles.mover} style={shift(onRail())}>
        <line
          x1={RAIL_X - 18}
          x2={RAIL_X + 5}
          y1={MID_Y}
          y2={MID_Y}
          class={styles.hair}
          data-line="lower"
        />
      </g>

      {/* The glass. */}
      <circle cx={GLASS_X} cy={MID_Y} r={GLASS_R + 8} class={styles.disc} />
      <circle
        cx={GLASS_X}
        cy={MID_Y}
        r={GLASS_R}
        fill={`url(#${shine})`}
        class={styles.glass}
      />
      <g clip-path={`url(#${clip})`}>
        <g class={styles.mover} style={shift(-inGlass())}>
          <line
            x1={GLASS_X - 96}
            x2={props.reveal !== null && !wide() ? GLASS_X - 8 : GLASS_X + 96}
            y1={MID_Y}
            y2={MID_Y}
            class={`${styles.hair} ${styles.magnified}`}
            classList={{ [styles.higher]: props.reveal !== null }}
            data-line="upper-magnified"
          />
        </g>
        <g class={styles.mover} style={shift(inGlass())}>
          <line
            x1={GLASS_X - 96}
            x2={GLASS_X + 96}
            y1={MID_Y}
            y2={MID_Y}
            class={`${styles.hair} ${styles.magnified}`}
            data-line="lower-magnified"
          />
        </g>
      </g>
      <text
        x={GLASS_X}
        y={wide() ? MID_Y + 7 : MID_Y - 64}
        class={styles.readout}
        text-anchor="middle"
        data-testid="loupe-readout"
      >
        {readout()}
      </text>
      <Show when={props.reveal !== null}>
        <text
          x={wide() ? GLASS_X : GLASS_X - 2}
          y={tagY()}
          class={styles.tag}
          text-anchor={wide() ? 'middle' : 'start'}
          dominant-baseline="central"
          data-testid="loupe-higher"
        >
          {higherName()}
        </text>
        <text
          x={GLASS_X}
          y={wide() ? MID_Y + 30 : MID_Y + 78}
          class={styles.magnification}
          text-anchor="middle"
          data-testid="loupe-magnification"
        >
          ×{magnification()}
        </text>
      </Show>
    </svg>
  )
}
