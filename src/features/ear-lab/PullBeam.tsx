// ============================================================
// PullBeam — The Pull's instrument.
//
// A balance on the bench with a pan for each degree, First and
// Second. The beam stays level while the two notes sound — a lamp
// on the sounding pan is all it shows — and tips at the reveal
// toward the degree that leans harder, farther for a harder lean,
// with the resolution named on the plate.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

export interface PullReveal {
  /** Which pan holds the degree that leans harder. */
  side: 1 | 2
  /** Its pull, 1..4 — sets the tilt. */
  pull: number
  /** "Ti leaning to Do′". */
  word: string
}

interface PullBeamProps {
  /** The note sounding now: 1, 2, or 0 for none. */
  sounding: 0 | 1 | 2
  reveal: PullReveal | null
}

const PIVOT_X = 260
const PIVOT_Y = 118
const HALF = 150

export function PullBeam(props: PullBeamProps): JSX.Element {
  // Tilt toward the leaning side: positive drops the second pan.
  const tilt = () =>
    props.reveal
      ? (props.reveal.side === 2 ? 1 : -1) * (4 + props.reveal.pull * 2.5)
      : 0
  const rad = () => (tilt() * Math.PI) / 180
  const end = (sign: -1 | 1) => ({
    x: PIVOT_X + sign * HALF * Math.cos(rad()),
    y: PIVOT_Y + sign * HALF * Math.sin(rad()),
  })
  const label = () =>
    props.reveal
      ? `Balance tipped to the ${props.reveal.side === 1 ? 'first' : 'second'} pan: ${props.reveal.word}`
      : props.sounding > 0
        ? `Balance level, the ${props.sounding === 1 ? 'first' : 'second'} pan sounding`
        : 'Balance level, at rest'

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="beam"
    >
      <path
        d="M236 236 L260 150 L284 236 Z"
        class={styles.metronomeBody}
        data-part="stand"
      />
      <line
        x1={end(-1).x}
        y1={end(-1).y}
        x2={end(1).x}
        y2={end(1).y}
        class={styles.beamArm}
        data-part="beam"
        data-tilt={tilt()}
      />
      <circle cx={PIVOT_X} cy={PIVOT_Y} r="5" class={styles.pivot} />
      <For each={[-1, 1] as const}>
        {(sign) => {
          const side = () => (sign === -1 ? 1 : 2) as 1 | 2
          const at = () => end(sign)
          const leaning = () => props.reveal?.side === side()
          return (
            <g data-part="pan" data-side={side()} data-leaning={leaning()}>
              <line
                x1={at().x}
                y1={at().y}
                x2={at().x}
                y2={at().y + 52}
                class={styles.rod}
              />
              <path
                d={`M${at().x - 34} ${at().y + 52} Q${at().x} ${at().y + 74} ${at().x + 34} ${at().y + 52}`}
                class={styles.pan}
                classList={{ [styles.panLeaning]: leaning() }}
              />
              <circle
                cx={at().x}
                cy={at().y + 40}
                r="5"
                class={styles.lamp}
                classList={{ [styles.lampLit]: props.sounding === side() }}
                data-part="lamp"
                data-lit={props.sounding === side()}
              />
              <text
                x={at().x}
                y={at().y + 96}
                class={styles.caption}
                text-anchor="middle"
              >
                {side() === 1 ? 'First' : 'Second'}
              </text>
            </g>
          )
        }}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="260"
            y="36"
            class={styles.nameplate}
            text-anchor="middle"
            data-part="nameplate"
          >
            {reveal().word}
          </text>
        )}
      </Show>
    </svg>
  )
}
