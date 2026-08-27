// ============================================================
// IndexArc — Leap's instrument.
//
// A dividing engine's index arc: twelve semitone divisions across a
// half circle. The root index lights with the first note; with the
// second the needle hunts across the arc without settling — the
// angle IS the answer, so it cannot show until the reveal, when the
// needle sweeps to the true interval and a garnet ghost marks a
// wrong pick.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

interface IndexArcProps {
  /** Which note is sounding: 1, 2, or 0. */
  sounding: 0 | 1 | 2
  /** The second note has sounded and the answer is open. */
  hunting: boolean
  reveal: {
    semitones: number
    name: string
    wrongSemitones: number | null
  } | null
}

const PIVOT_X = 260
const PIVOT_Y = 250
const RADIUS = 200
const DIVISIONS = Array.from({ length: 13 }, (_, i) => i)
const MAJOR = new Set([0, 5, 7, 12])

function point(semitones: number, radius: number): { x: number; y: number } {
  const angle = Math.PI - (semitones / 12) * Math.PI
  return {
    x: PIVOT_X + Math.cos(angle) * radius,
    y: PIVOT_Y - Math.sin(angle) * radius,
  }
}

function degrees(semitones: number): number {
  return (semitones / 12) * 180
}

export function IndexArc(props: IndexArcProps): JSX.Element {
  const label = () =>
    props.reveal
      ? `Index arc swept ${props.reveal.semitones} semitones from the root: ${props.reveal.name}`
      : props.hunting
        ? 'Index arc, the needle hunting for the interval'
        : 'Index arc, twelve semitone divisions from the root'

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 300"
      role="img"
      aria-label={label()}
      data-instrument="arc"
    >
      <path
        d={`M ${PIVOT_X - RADIUS} ${PIVOT_Y} A ${RADIUS} ${RADIUS} 0 0 1 ${
          PIVOT_X + RADIUS
        } ${PIVOT_Y}`}
        class={styles.arc}
      />
      <For each={DIVISIONS}>
        {(k) => {
          const outer = point(k, RADIUS)
          const inner = point(k, RADIUS - (MAJOR.has(k) ? 18 : 10))
          const text = point(k, RADIUS + 18)
          return (
            <>
              <line
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
                class={styles.tick}
                classList={{ [styles.tickMajor]: MAJOR.has(k) }}
              />
              <text
                x={text.x}
                y={text.y}
                class={styles.caption}
                text-anchor="middle"
                dominant-baseline="middle"
              >
                {k}
              </text>
            </>
          )
        }}
      </For>

      {/* the root index */}
      <path
        d={`M ${PIVOT_X - RADIUS + 4} ${PIVOT_Y - 8} l 22 -8 v 16 z`}
        class={styles.rootIndex}
        classList={{ [styles.rootIndexLit]: props.sounding === 1 }}
      />

      {/* the ghost of a wrong pick */}
      <Show when={props.reveal?.wrongSemitones}>
        {(wrong) => (
          <line
            x1={PIVOT_X}
            y1={PIVOT_Y}
            x2={PIVOT_X - RADIUS + 26}
            y2={PIVOT_Y}
            class={`${styles.needle} ${styles.needleGhost}`}
            style={{ transform: `rotate(${degrees(wrong())}deg)` }}
          />
        )}
      </Show>

      {/* the needle */}
      <line
        x1={PIVOT_X}
        y1={PIVOT_Y}
        x2={PIVOT_X - RADIUS + 26}
        y2={PIVOT_Y}
        class={styles.needle}
        classList={{
          [styles.needleHunting]: props.reveal === null && props.hunting,
          [styles.needleIdle]: props.reveal === null && !props.hunting,
        }}
        style={
          props.reveal
            ? { transform: `rotate(${degrees(props.reveal.semitones)}deg)` }
            : undefined
        }
      />
      <circle cx={PIVOT_X} cy={PIVOT_Y} r="8" class={styles.hub} />

      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x={PIVOT_X}
            y="292"
            class={`${styles.nameplate} ${styles.nameplateSignal}`}
            text-anchor="middle"
          >
            {reveal().name}
          </text>
        )}
      </Show>
    </svg>
  )
}
