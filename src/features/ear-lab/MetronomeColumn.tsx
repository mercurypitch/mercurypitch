// ============================================================
// MetronomeColumn — Drift's instrument.
//
// A metronome on the bench with a lamp per click up its column. The
// lamps light in turn as the clicks sound — at even spacing, never
// at the displaced timing, since the timing is the question — and
// the arm stays upright until the reveal, when it leans forward for
// a tempo that gained, back for one that lost, and holds for steady.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { DriftWay } from '@/lib/ear/beat'
import styles from './EarInstruments.module.css'

interface MetronomeColumnProps {
  /** Clicks in the train. */
  count: number
  /** 1-based index of the click sounding; 0 for none. */
  lit: number
  /** Clicks in the steady half — the lamps above them are the drift. */
  steady: number
  reveal: { way: DriftWay; percent: string } | null
}

const PIVOT_X = 260
const PIVOT_Y = 190
const ARM_LEN = 130

export function MetronomeColumn(props: MetronomeColumnProps): JSX.Element {
  const lean = () =>
    props.reveal?.way === 'faster'
      ? 22
      : props.reveal?.way === 'slower'
        ? -22
        : 0
  const armTip = () => ({
    x: PIVOT_X + Math.sin((lean() * Math.PI) / 180) * ARM_LEN,
    y: PIVOT_Y - Math.cos((lean() * Math.PI) / 180) * ARM_LEN,
  })
  const label = () =>
    props.reveal
      ? `Metronome: the tempo ${
          props.reveal.way === 'steady'
            ? 'held steady'
            : `${props.reveal.way === 'faster' ? 'gained' : 'lost'} ${props.reveal.percent} percent`
        }`
      : props.lit > 0
        ? `Metronome, click ${props.lit} of ${props.count}`
        : `Metronome at rest, ${props.count} clicks`

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="metronome"
    >
      <path
        d="M205 232 L235 46 H285 L315 232 Z"
        class={styles.metronomeBody}
        data-part="body"
      />
      <line
        x1={PIVOT_X}
        y1={PIVOT_Y}
        x2={armTip().x}
        y2={armTip().y}
        class={styles.metronomeArm}
        data-part="arm"
        data-lean={lean()}
      />
      <circle
        cx={armTip().x}
        cy={armTip().y}
        r="7"
        class={styles.metronomeWeight}
        data-part="weight"
      />
      <circle cx={PIVOT_X} cy={PIVOT_Y} r="4" class={styles.pivot} />
      <For each={Array.from({ length: props.count }, (_, i) => i)}>
        {(i) => {
          const x = () =>
            props.count <= 1 ? 260 : 96 + (i / (props.count - 1)) * 328
          return (
            <circle
              cx={x()}
              cy="248"
              r="5"
              class={styles.lamp}
              classList={{
                [styles.lampLit]: props.lit === i + 1,
                [styles.lampDrift]: i >= props.steady,
              }}
              data-part="lamp"
              data-lit={props.lit === i + 1}
            />
          )
        }}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="260"
            y="30"
            class={styles.nameplate}
            text-anchor="middle"
            data-part="nameplate"
          >
            {reveal().way === 'steady'
              ? 'Steady'
              : `${reveal().way === 'faster' ? 'Faster' : 'Slower'} by ${reveal().percent}%`}
          </text>
        )}
      </Show>
    </svg>
  )
}
