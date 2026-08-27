// ============================================================
// GearTrain — Stack's instrument.
//
// A gear train seen end-on: the chord's tones are wheels on one
// arbor, each at its interval above the root, meshing side by side —
// even wheels left of the arbor, odd wheels right — so two tones a
// semitone or two apart (a suspended fourth's 5 and 7) sit as
// neighbours instead of piling up. While the chord sounds four ghost
// wheels turn at even spacing — the count would give the quality
// away — and the reveal sets the true wheels at their heights with
// the tooth pattern of the quality named.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

interface GearTrainProps {
  sounding: boolean
  /** The chord, once told: intervals above the root in semitones. */
  reveal: { intervals: readonly number[]; name: string } | null
}

const AXLE_X = 170
const ROOT_Y = 236
const PX_PER_SEMITONE = 15
const WHEEL_R = 34
/** Half the distance between the two columns of wheels: neighbours
 *  touch at their teeth, whatever their heights. */
const MESH_OFFSET = 36
const LABEL_X = AXLE_X + MESH_OFFSET + WHEEL_R + 14
const GHOST_STACK = [0, 4, 8, 12]

function wheelY(semitones: number): number {
  return ROOT_Y - semitones * PX_PER_SEMITONE
}

function wheelX(index: number): number {
  return AXLE_X + (index % 2 === 0 ? -MESH_OFFSET : MESH_OFFSET)
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
      viewBox="0 0 360 330"
      role="img"
      aria-label={label()}
      data-instrument="gears"
    >
      <line
        x1={AXLE_X}
        y1="48"
        x2={AXLE_X}
        y2={ROOT_Y + WHEEL_R + 8}
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
              'transform-origin': `${wheelX(i())}px ${wheelY(semitones)}px`,
            }}
          >
            <circle
              cx={wheelX(i())}
              cy={wheelY(semitones)}
              r={WHEEL_R}
              class={styles.teeth}
              classList={{
                [styles.teethGhost]: props.reveal === null,
                [styles.teethTrue]: props.reveal !== null,
              }}
              stroke-dasharray={`${3 + (semitones % 4)} 4`}
            />
            <circle
              cx={wheelX(i())}
              cy={wheelY(semitones)}
              r={WHEEL_R - 4}
              class={styles.rim}
              classList={{
                [styles.rimGhost]: props.reveal === null,
                [styles.rimTrue]: props.reveal !== null,
              }}
            />
            <circle
              cx={wheelX(i())}
              cy={wheelY(semitones)}
              r="6"
              class={styles.hub}
            />
            <Show when={props.reveal !== null}>
              <text
                x={LABEL_X}
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
            y="318"
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
