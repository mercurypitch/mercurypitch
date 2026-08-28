// ============================================================
// ProgressionTrain — Cadence's instrument.
//
// A going train of wheels, one per chord, in a row. While the
// progression sounds each wheel turns in its turn — every wheel
// the same size, so nothing about the drawing says which chord is
// which. The reveal engraves the numeral on every wheel and the
// progression's name on the plate.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { romanOf } from '@/lib/ear/progressions'
import styles from './EarInstruments.module.css'

interface ProgressionTrainProps {
  /** Chords in the progression (3 or 4). */
  count: number
  /** 1-based index of the chord sounding; 0 for none. */
  sounding: number
  reveal: { degrees: readonly number[]; name: string } | null
}

const AXLE_Y = 128
const WHEEL_R = 36
const TEETH = 12

function wheelX(index: number, count: number): number {
  const span = (count - 1) * 92
  return 260 - span / 2 + index * 92
}

function toothPath(cx: number, cy: number): string {
  const parts: string[] = []
  for (let t = 0; t < TEETH; t++) {
    const a = (t / TEETH) * Math.PI * 2
    const inner = WHEEL_R - 4
    const outer = WHEEL_R + 4
    parts.push(
      `M${cx + Math.cos(a) * inner} ${cy + Math.sin(a) * inner}L${cx + Math.cos(a) * outer} ${cy + Math.sin(a) * outer}`,
    )
  }
  return parts.join('')
}

export function ProgressionTrain(props: ProgressionTrainProps): JSX.Element {
  const count = () => Math.max(1, props.reveal?.degrees.length ?? props.count)
  const label = () =>
    props.reveal
      ? `Going train engraved ${props.reveal.name}`
      : props.sounding > 0
        ? `Going train, wheel ${props.sounding} of ${count()} turning`
        : `Going train of ${count()} wheels at rest`

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="train"
    >
      <line x1="60" y1="216" x2="460" y2="216" class={styles.beam} />
      <For each={Array.from({ length: count() }, (_, i) => i)}>
        {(i) => {
          const cx = () => wheelX(i, count())
          const turning = () => props.sounding === i + 1
          return (
            <g
              data-part="wheel"
              data-turning={turning()}
              class={styles.trainWheel}
              classList={{ [styles.trainWheelTurning]: turning() }}
              style={{ 'transform-origin': `${cx()}px ${AXLE_Y}px` }}
            >
              <circle cx={cx()} cy={AXLE_Y} r={WHEEL_R} class={styles.rim} />
              <path d={toothPath(cx(), AXLE_Y)} class={styles.teeth} />
              <circle cx={cx()} cy={AXLE_Y} r="5" class={styles.pivot} />
              <Show when={props.reveal}>
                {(reveal) => (
                  <text
                    x={cx()}
                    y={AXLE_Y + 7}
                    class={styles.wheelNumeral}
                    text-anchor="middle"
                    data-part="numeral"
                  >
                    {romanOf(reveal().degrees[i] ?? 1)}
                  </text>
                )}
              </Show>
            </g>
          )
        }}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="260"
            y="246"
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
