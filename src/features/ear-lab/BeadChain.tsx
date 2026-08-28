// ============================================================
// BeadChain — Echo's and Span's instrument.
//
// A chain of beads on the paper, one per note. While the phrase
// sounds the beads sit on one level line and light in turn — their
// heights would draw the contour for the eye, and the ear is meant
// to hold it. The reveal strings the phrase at its true heights in
// brass and marks each answered note on the same rung: signal where
// it matched, garnet at the height that was tapped instead, with
// the slip named on the plate.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { degreeSolfege } from '@/lib/ear/phrase'
import styles from './EarInstruments.module.css'

export interface ChainReveal {
  expected: readonly number[]
  answered: readonly number[]
  perNote: readonly boolean[]
}

interface BeadChainProps {
  /** Notes in the phrase. */
  count: number
  /** 1-based index of the note sounding now; 0 for none. */
  sounding: number
  reveal: ChainReveal | null
}

const LEFT = 100
const RIGHT = 420
const LEVEL_Y = 130
const LOW_Y = 196
const HIGH_Y = 64
const RULES = [70, 100, 130, 160, 190]

function beadX(index: number, count: number): number {
  if (count <= 1) return (LEFT + RIGHT) / 2
  return LEFT + (index / (count - 1)) * (RIGHT - LEFT)
}

function degreeY(degree: number): number {
  return LOW_Y - ((degree - 1) / 7) * (LOW_Y - HIGH_Y)
}

export function BeadChain(props: BeadChainProps): JSX.Element {
  const count = () => Math.max(1, props.reveal?.expected.length ?? props.count)
  const radius = () => Math.min(9, Math.max(5, 120 / count()))
  const label = () => {
    if (props.reveal) {
      const missed = props.reveal.perNote.filter((ok) => !ok).length
      return missed === 0
        ? `Bead chain: all ${props.reveal.expected.length} notes matched`
        : `Bead chain: ${missed} of ${props.reveal.expected.length} notes off`
    }
    return props.sounding > 0
      ? `Bead chain, note ${props.sounding} of ${count()} sounding`
      : `Bead chain of ${count()} notes, heights not yet shown`
  }

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="chain"
    >
      <rect
        x="70"
        y="50"
        width="380"
        height="160"
        rx="18"
        class={styles.drum}
        data-part="drum"
      />
      <For each={RULES}>
        {(y) => <line x1="80" y1={y} x2="440" y2={y} class={styles.drumRule} />}
      </For>

      <Show
        when={props.reveal}
        fallback={
          <For each={Array.from({ length: count() }, (_, i) => i)}>
            {(i) => (
              <circle
                cx={beadX(i, count())}
                cy={LEVEL_Y}
                r={radius()}
                class={styles.bead}
                classList={{
                  [styles.beadSounded]: props.sounding > i + 1,
                  [styles.beadLit]: props.sounding === i + 1,
                }}
                data-part="bead"
                data-lit={props.sounding === i + 1}
              />
            )}
          </For>
        }
      >
        {(reveal) => (
          <>
            <polyline
              points={reveal()
                .expected.map(
                  (degree, i) =>
                    `${beadX(i, reveal().expected.length)},${degreeY(degree)}`,
                )
                .join(' ')}
              class={styles.chainLine}
            />
            <For each={reveal().expected}>
              {(degree, i) => (
                <>
                  <circle
                    cx={beadX(i(), reveal().expected.length)}
                    cy={degreeY(degree)}
                    r={radius()}
                    class={`${styles.bead} ${styles.beadTrue}`}
                    data-part="expected"
                    data-degree={degree}
                  />
                  <Show when={!reveal().perNote[i()]}>
                    <circle
                      cx={beadX(i(), reveal().expected.length)}
                      cy={degreeY(Math.max(1, reveal().answered[i()] ?? 1))}
                      r={radius() + 3}
                      class={styles.beadWrong}
                      classList={{
                        [styles.beadMissing]: (reveal().answered[i()] ?? 0) < 1,
                      }}
                      data-part="wrong"
                    />
                  </Show>
                  <Show when={reveal().perNote[i()]}>
                    <circle
                      cx={beadX(i(), reveal().expected.length)}
                      cy={degreeY(degree)}
                      r={radius() + 3}
                      class={styles.beadRight}
                      data-part="right"
                    />
                  </Show>
                  <text
                    x={beadX(i(), reveal().expected.length)}
                    y="226"
                    class={styles.caption}
                    text-anchor="middle"
                  >
                    {degreeSolfege(degree)}
                  </text>
                </>
              )}
            </For>
          </>
        )}
      </Show>
    </svg>
  )
}
