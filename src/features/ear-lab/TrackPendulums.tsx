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
  /** Standing alone at rest (the ritual's idle): long rods, so the
   *  strip is an instrument in its own right rather than a footer. */
  tall?: boolean
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

  const tall = () => props.tall === true
  const rodEnd = () => (tall() ? 230 : 110)
  const bobY = () => (tall() ? 240 : 120)
  const bobR = () => (tall() ? 16 : 14)
  const captionY = () => (tall() ? 285 : 152)

  return (
    <svg
      class={styles.instrument}
      viewBox={tall() ? '0 0 640 300' : '0 0 640 160'}
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
                y2={rodEnd()}
                class={styles.calRod}
              />
              <circle
                cx={rodX(i())}
                cy={bobY()}
                r={bobR()}
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
              y={captionY()}
              class={styles.caption}
              classList={{ [styles.captionBrass]: props.sealed }}
              style={{ 'font-size': tall() ? '15px' : undefined }}
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
