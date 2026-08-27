// ============================================================
// TrackPendulums — the calibration strip.
//
// Three pendulums, one per interleaved track. They swing while the
// calibration runs, the active track's bob lit; when every track
// has run to the end they fall into phase and the bobs turn brass —
// the seal. Counts under each say how far its staircase has turned.
// ============================================================

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import styles from './EarInstruments.module.css'

interface TrackPendulumsProps {
  /** Reversals recorded per track. */
  counts: readonly number[]
  /** Reversals each track needs. */
  target: number
  /** Index of the track whose trial is sounding. */
  active: number
  running: boolean
  sealed: boolean
}

const TRACKS = ['A', 'B', 'C']

function rodX(i: number): number {
  return 200 + i * 120
}

export function TrackPendulums(props: TrackPendulumsProps): JSX.Element {
  const label = () =>
    props.sealed
      ? 'Three track pendulums in phase: sealed'
      : `Three track pendulums: ${TRACKS.map(
          (name, i) => `${name} ${props.counts[i] ?? 0} of ${props.target}`,
        ).join(', ')}`

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 640 160"
      role="img"
      aria-label={label()}
      data-instrument="pendulums"
    >
      <line
        x1="80"
        y1="20"
        x2="560"
        y2="20"
        class={styles.brassLine}
        stroke-width="3"
      />
      <For each={TRACKS}>
        {(name, i) => (
          <>
            <g
              class={styles.calPendulum}
              classList={{
                [styles.calSwing]: props.running,
                [styles.calSealed]: props.sealed,
              }}
              style={{
                '--phase': String(i() - 1),
                'transform-origin': `${rodX(i())}px 20px`,
              }}
            >
              <line
                x1={rodX(i())}
                y1="20"
                x2={rodX(i())}
                y2="110"
                class={styles.calRod}
              />
              <circle
                cx={rodX(i())}
                cy="120"
                r="14"
                class={styles.calBob}
                classList={{
                  [styles.calBobActive]:
                    props.running && !props.sealed && props.active === i(),
                  [styles.calBobSealed]: props.sealed,
                }}
              />
            </g>
            <text
              x={rodX(i())}
              y="152"
              class={styles.caption}
              classList={{ [styles.captionBrass]: props.sealed }}
              text-anchor="middle"
            >
              {name} · {props.counts[i()] ?? 0}/{props.target}
            </text>
          </>
        )}
      </For>
    </svg>
  )
}
