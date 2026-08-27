// ============================================================
// EscapementLattice — The Grid's instrument.
//
// Six pallets on a lattice. While the clicks sound, a chase light
// steps along the pallets ON THE GRID — never on the displaced
// click, or the eye would answer for the ear. Only the reveal
// pushes the off pallet out of line, early or late.
// ============================================================

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import styles from './EarInstruments.module.css'

interface EscapementLatticeProps {
  /** 1-based index of the click sounding now; 0 for none. */
  lit: number
  running: boolean
  /** The displaced click, once told: 0-based index and direction. */
  reveal: { index: number; early: boolean } | null
}

const PALLETS = [0, 1, 2, 3, 4, 5]
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

function palletX(i: number): number {
  return 56 + i * 78
}

export function EscapementLattice(props: EscapementLatticeProps): JSX.Element {
  const label = () =>
    props.reveal
      ? `Six pallets on a lattice; the ${ORDINALS[props.reveal.index]} is ${
          props.reveal.early ? 'early' : 'late'
        }`
      : 'Six pallets on a lattice; one of the last four is off the grid'

  const chaseIndex = () => Math.max(0, Math.min(5, props.lit - 1))

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 200"
      role="img"
      aria-label={label()}
      data-instrument="lattice"
    >
      <rect x="8" y="8" width="504" height="184" rx="8" class={styles.frame} />
      <line
        x1="30"
        y1="124"
        x2="490"
        y2="124"
        class={styles.faintLine}
        stroke-width="1"
      />
      <For each={PALLETS}>
        {(i) => {
          const off = () => props.reveal?.index === i
          return (
            <>
              <rect
                x={palletX(i) - 13}
                y="40"
                width="26"
                height="78"
                rx="4"
                class={styles.pallet}
                classList={{
                  [styles.palletLit]: props.running && props.lit === i + 1,
                  [styles.palletOff]: off(),
                  [styles.palletEarly]: off() && props.reveal?.early === true,
                  [styles.palletLate]: off() && props.reveal?.early === false,
                }}
              />
              <text
                x={palletX(i)}
                y="150"
                class={styles.caption}
                classList={{ [styles.captionGarnet]: off() }}
                text-anchor="middle"
              >
                {i + 1}
              </text>
            </>
          )
        }}
      </For>
      <rect
        x={palletX(chaseIndex()) - 32}
        y="126"
        width="64"
        height="3"
        rx="1.5"
        class={styles.chase}
        classList={{ [styles.chaseOn]: props.running && props.lit > 0 }}
      />
      <text x="260" y="180" class={styles.caption} text-anchor="middle">
        500 ms lattice
      </text>
    </svg>
  )
}
