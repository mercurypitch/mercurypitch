// ============================================================
// BeatPendulums — Beat Hunt's instrument.
//
// Two pairs of pendulums on one bench, First and Second, one pair
// per dyad. While a dyad sounds its pair swings, the two bobs
// together — the drawing never hints which pair is beating, because
// that is the question. At the reveal the detuned pair's second bob
// hangs out of phase with the first, and the nameplate says how fast
// the beats ran.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { beatWord } from '@/lib/ear/beat'
import styles from './EarInstruments.module.css'

export interface BeatReveal {
  /** Which dyad was detuned. */
  pair: 1 | 2
  rateHz: number
}

interface BeatPendulumsProps {
  /** The dyad sounding now: 1, 2, or 0 for none. */
  sounding: 0 | 1 | 2
  reveal: BeatReveal | null
}

const PAIR_X = [150, 370]
const ROD_TOP = 58
const ROD_LEN = 118
const SWING = 9

function bobX(cx: number, offset: number, swing: number): number {
  return cx + offset + swing
}

export function BeatPendulums(props: BeatPendulumsProps): JSX.Element {
  const label = () =>
    props.reveal
      ? `Beat pendulums: the ${props.reveal.pair === 1 ? 'first' : 'second'} pair was beating, ${beatWord(props.reveal.rateHz)}`
      : props.sounding > 0
        ? `Beat pendulums, the ${props.sounding === 1 ? 'first' : 'second'} pair swinging`
        : 'Two pairs of pendulums at rest'

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="beat-pendulums"
    >
      <line x1="60" y1={ROD_TOP} x2="460" y2={ROD_TOP} class={styles.beam} />
      <For each={PAIR_X}>
        {(cx, i) => {
          const pair = () => (i() + 1) as 1 | 2
          const swinging = () => props.sounding === pair()
          const beating = () => props.reveal?.pair === pair()
          // At the reveal the beating pair's second bob hangs displaced;
          // the two swing together at every other moment.
          const secondOffset = () => (beating() ? 22 : 0)
          return (
            <g data-part="pair" data-pair={pair()} data-beating={beating()}>
              <For each={[-16, 16]}>
                {(offset, j) => {
                  const swing = () => (swinging() ? SWING : 0)
                  const x = () =>
                    bobX(
                      cx,
                      offset,
                      j() === 1 ? swing() + secondOffset() : swing(),
                    )
                  return (
                    <>
                      <line
                        x1={cx + offset}
                        y1={ROD_TOP}
                        x2={x()}
                        y2={ROD_TOP + ROD_LEN}
                        class={styles.rod}
                        classList={{ [styles.rodSwinging]: swinging() }}
                        data-part="rod"
                      />
                      <circle
                        cx={x()}
                        cy={ROD_TOP + ROD_LEN}
                        r="9"
                        class={styles.bob}
                        classList={{
                          [styles.bobLit]: swinging(),
                          [styles.bobBeating]: beating(),
                        }}
                        data-part="bob"
                      />
                    </>
                  )
                }}
              </For>
              <text x={cx} y="216" class={styles.caption} text-anchor="middle">
                {pair() === 1 ? 'First' : 'Second'}
              </text>
            </g>
          )
        }}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="260"
            y="244"
            class={styles.nameplate}
            text-anchor="middle"
            data-part="nameplate"
          >
            {beatWord(reveal().rateHz)}
          </text>
        )}
      </Show>
    </svg>
  )
}
