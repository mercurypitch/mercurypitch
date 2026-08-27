// ============================================================
// GearTrain — Stack's instrument.
//
// A gear train seen end-on: the chord's tones are wheels stacked on
// one axle, each at its interval above the root. While the chord
// sounds four ghost wheels turn at even spacing — the count would
// give the quality away — and the reveal sets the true wheels at
// their heights with the tooth pattern of the quality named.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

interface GearTrainProps {
  sounding: boolean
  /** The chord, once told: intervals above the root in semitones. */
  reveal: { intervals: readonly number[]; name: string } | null
}

const AXLE_X = 180
const ROOT_Y = 250
const PX_PER_SEMITONE = 13
const GHOST_STACK = [0, 4, 8, 12]

function wheelY(semitones: number): number {
  return ROOT_Y - semitones * PX_PER_SEMITONE
}

export function GearTrain(props: GearTrainProps): JSX.Element {
  const stack = () =>
    props.reveal ? [0, ...props.reveal.intervals] : GHOST_STACK

  const label = () =>
    props.reveal
      ? `Gear train of ${props.reveal.intervals.length + 1} wheels: ${props.reveal.name}`
      : 'Gear train, the wheels turning while the chord sounds'

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 360 300"
      role="img"
      aria-label={label()}
      data-instrument="gears"
    >
      <line
        x1={AXLE_X}
        y1="70"
        x2={AXLE_X}
        y2={ROOT_Y + 30}
        class={styles.axle}
      />
      <For each={stack()}>
        {(semitones, i) => (
          <g
            class={styles.wheel}
            classList={{
              [styles.wheelSpin]: props.sounding && props.reveal === null,
              [styles.wheelSpinReverse]: i() % 2 === 1,
            }}
            style={{
              'transform-origin': `${AXLE_X}px ${wheelY(semitones)}px`,
            }}
          >
            <circle
              cx={AXLE_X}
              cy={wheelY(semitones)}
              r="34"
              class={styles.teeth}
              classList={{
                [styles.teethGhost]: props.reveal === null,
                [styles.teethTrue]: props.reveal !== null,
              }}
              stroke-dasharray={`${3 + (semitones % 4)} 4`}
            />
            <circle
              cx={AXLE_X}
              cy={wheelY(semitones)}
              r="30"
              class={styles.rim}
              classList={{
                [styles.rimGhost]: props.reveal === null,
                [styles.rimTrue]: props.reveal !== null,
              }}
            />
            <circle
              cx={AXLE_X}
              cy={wheelY(semitones)}
              r="6"
              class={styles.hub}
            />
            <Show when={props.reveal !== null}>
              <text
                x={AXLE_X + 52}
                y={wheelY(semitones)}
                class={`${styles.caption} ${styles.captionBrass}`}
                dominant-baseline="middle"
              >
                {semitones === 0 ? 'root' : `+${semitones}`}
              </text>
            </Show>
          </g>
        )}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x={AXLE_X}
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
