// ============================================================
// MetreLattice — Subdivide's instrument.
//
// A lattice of pallets, one per step of the bar, the lamps chasing
// the kit through two bars. Every pallet is drawn the same — no
// bar line, no accent — because how the steps group is the
// question. The reveal lights beat one's lamp in brass, draws the
// bar line before it, and names the metre.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

interface MetreLatticeProps {
  /** Steps in the bar. */
  steps: number
  /** 1-based step sounding now (within the bar); 0 for none. */
  lit: number
  reveal: { name: string } | null
}

const TOP_Y = 84
const BOTTOM_Y = 176

function palletX(i: number, count: number): number {
  const span = Math.min(400, (count - 1) * 68)
  return 260 - span / 2 + (count <= 1 ? 0 : (i / (count - 1)) * span)
}

export function MetreLattice(props: MetreLatticeProps): JSX.Element {
  const count = () => Math.max(1, props.steps)
  const label = () =>
    props.reveal
      ? `Lattice of ${count()} pallets: ${props.reveal.name}`
      : props.lit > 0
        ? `Lattice, pallet ${props.lit} of ${count()} lit`
        : `Lattice of ${count()} pallets at rest`

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
          const lit = () => props.lit === i + 1
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
