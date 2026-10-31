// ============================================================
// MetreLattice — Subdivide's instrument.
//
// A lattice of pallets, the lamps chasing the kit through two bars.
// Every pallet is drawn the same — no bar line, no accent — because
// how the steps group is the question. Until the reveal it stands at
// seven pallets whatever the metre, and the lamp runs on round them
// across both bars, so neither the pallets nor where the lamp starts
// again say how long the bar is: the eye knows no more than the ear.
// The reveal lays the bar out, one pallet a step, lights beat one's
// lamp in brass, draws the bar line before it, and names the metre.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, on, Show } from 'solid-js'
import type { MetrePattern } from '@/lib/ear/metre'
import styles from './EarInstruments.module.css'
import { skinnable } from './instrument-skin'

export interface MetreLatticeProps {
  /** Steps in the bar. */
  steps: number
  /** 1-based step sounding now (within the bar); 0 for none. */
  lit: number
  reveal: { name: string } | null
  /** The bars' hits, for a stage that draws each drum on its own lane
   *  (the room's). The lattice here draws only the steps. */
  pattern?: MetrePattern | null
}

const TOP_Y = 84
const BOTTOM_Y = 176
/** The pallets before the reveal, whatever the metre: the longest bar's. */
const UNTOLD = 7

function palletX(i: number, count: number): number {
  const span = Math.min(400, (count - 1) * 68)
  return 260 - span / 2 + (count <= 1 ? 0 : (i / (count - 1)) * span)
}

function DrawnMetreLattice(props: MetreLatticeProps): JSX.Element {
  const count = () => (props.reveal ? Math.max(1, props.steps) : UNTOLD)
  // The steps sounded so far this question, across both bars: the lamp
  // runs on round the seven rather than starting again with the bar.
  const [sounded, setSounded] = createSignal(0)
  createEffect(
    on(
      () => props.lit,
      (lit, before) => {
        if (lit <= 0) setSounded(0)
        else if (lit !== before) setSounded((n) => n + 1)
      },
    ),
  )
  const label = () =>
    props.reveal
      ? `Lattice of ${count()} pallets: ${props.reveal.name}`
      : props.lit > 0
        ? 'Lattice, a lamp chasing the kit'
        : 'Lattice at rest'

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="metre"
    >
      <line x1="40" y1={TOP_Y} x2="480" y2={TOP_Y} class={styles.beam} />
      <line x1="40" y1={BOTTOM_Y} x2="480" y2={BOTTOM_Y} class={styles.beam} />
      <Show when={props.reveal}>
        <line
          x1={palletX(0, count()) - 26}
          y1={TOP_Y - 14}
          x2={palletX(0, count()) - 26}
          y2={BOTTOM_Y + 14}
          class={styles.barLine}
          data-part="bar-line"
        />
      </Show>
      <For each={Array.from({ length: count() }, (_, i) => i)}>
        {(i) => {
          const x = () => palletX(i, count())
          const lit = () =>
            props.reveal === null &&
            props.lit > 0 &&
            (sounded() - 1) % UNTOLD === i
          const accent = () => props.reveal !== null && i === 0
          return (
            <g data-part="pallet" data-lit={lit()} data-accent={accent()}>
              <line
                x1={x()}
                y1={TOP_Y}
                x2={x()}
                y2={BOTTOM_Y}
                class={styles.pallet}
                classList={{ [styles.palletLit]: lit() }}
              />
              <circle
                cx={x()}
                cy={BOTTOM_Y + 22}
                r="6"
                class={styles.lamp}
                classList={{
                  [styles.lampLit]: lit(),
                  [styles.lampAccent]: accent(),
                }}
                data-part="lamp"
              />
            </g>
          )
        }}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="260"
            y="44"
            class={styles.nameplate}
            text-anchor="middle"
            data-part="nameplate"
          >
            {reveal().name}
          </text>
        )}
      </Show>
    </svg>
  )
}

export const MetreLattice = skinnable('MetreLattice', DrawnMetreLattice)
