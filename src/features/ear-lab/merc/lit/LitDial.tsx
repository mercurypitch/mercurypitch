// ============================================================
// Leap's instrument in the room: an index arc of twelve semitones from
// the root to the octave, its needle on a pivot below
// (docs/plans/ear-lab-native-look.md).
//
// The root lights as the first note sounds. From the second note the
// needle hunts across the arc and never settles while the answer is
// open: where it pointed would be the answer. At the reveal it sweeps to
// the interval, the arc fills teal from the root to it, a wrong pick is
// marked red on the arc, and the interval is named with its semitones.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, on, Show, untrack } from 'solid-js'
import type { IndexArcProps } from '@/features/ear-lab/IndexArc'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import { clamp, easeInOut, hundredth, lerp, lineD, progress, tenth, } from './draw'
import { Glow, LitDefs, litIds, Orb, paint, RED, Ring, TEAL, TEAL_PALE, WHITE, } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over the twelve pads. */
const HEIGHT = 333
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const CX = 195
const CY = HEIGHT - 16
const R = 150

/** A point on the arc `semitones` along it, `radius` from the pivot. */
function at(semitones: number, radius: number): readonly [number, number] {
  const angle = Math.PI - (semitones / 12) * Math.PI
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)]
}

function arcD(from: number, to: number, radius: number): string {
  const [ax, ay] = at(from, radius)
  const [bx, by] = at(to, radius)
  return `M${tenth(ax)} ${tenth(ay)}A${radius} ${radius} 0 0 1 ${tenth(bx)} ${tenth(by)}`
}

/** Where the needle hunts while the answer is open, at ambient `ms`. */
const hunting = (ms: number): number => 6 + 4.6 * Math.sin(ms * 0.0032)

export function LitDial(props: IndexArcProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const arrivals = useArrivals(() => props.sounding, clock)
  const revealed = (): number =>
    props.reveal === null ? 0 : easeInOut(progress(clock.t(), 100, 700))
  const named = (): number =>
    props.reveal === null ? 0 : progress(clock.t(), 250, 650)

  /** Where the needle stood when the reveal came, to sweep from. */
  const [from, setFrom] = createSignal(6)
  createEffect(
    on(
      () => props.reveal !== null,
      (revealing) => {
        if (revealing) setFrom(hunting(untrack(clock.ambient)))
      },
    ),
  )

  const listening = (): boolean =>
    props.reveal === null &&
    !props.hunting &&
    (props.sounding > 0 || clock.beat() === 'listen')
  const sinceRoot = (): number | null =>
    listening() ? arrivalAge(arrivals(), 0, clock) : null
  const sinceSecond = (): number | null =>
    listening() ? arrivalAge(arrivals(), 1, clock) : null

  /** The needle: where it points, in semitones, and how bright. */
  const needle = (): { at: number; light: number } => {
    const reveal = props.reveal
    if (reveal !== null)
      return {
        at: lerp(from(), reveal.semitones, revealed()),
        light: 1,
      }
    if (clock.reduced) return { at: 6, light: 0.55 }
    const ms = clock.ambient()
    if (props.hunting) return { at: clamp(hunting(ms), 0.3, 11.7), light: 0.55 }
    if (sinceSecond() !== null)
      return {
        at: clamp(
          6 + 5 * Math.sin(ms * 0.012) + 1.1 * Math.sin(ms * 0.031),
          0.3,
          11.7,
        ),
        light: 1,
      }
    return { at: 0, light: 0.45 }
  }
  const tip = (): readonly [number, number] => at(needle().at, R - 18)

  const label = (): string => {
    const reveal = props.reveal
    if (reveal !== null)
      return `An arc of twelve semitones: ${reveal.name}, ${reveal.semitones} semitones`
    if (props.hunting) return 'An arc of twelve semitones, the needle hunting'
    return props.sounding > 0
      ? `An arc of twelve semitones, note ${props.sounding} sounding`
      : 'An arc of twelve semitones at rest'
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="interval-dial"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <path
        d={arcD(0, 12, R + 26)}
        fill="none"
        stroke={paint(ids.across)}
        stroke-width="40"
        opacity="0.06"
      />
      <Glow d={arcD(0, 12, R)} width={2.4} stroke={paint(ids.across)} />
      <path
        d={arcD(0, 12, R - 34)}
        fill="none"
        stroke="rgb(255 255 255 / 7%)"
      />
      <For each={Array.from({ length: 13 }, (_, s) => s)}>
        {(s) => {
          const [ax, ay] = at(s, R - 10)
          const [bx, by] = at(s, R + (s % 12 === 0 ? 12 : 7))
          return (
            <line
              x1={tenth(ax)}
              y1={tenth(ay)}
              x2={tenth(bx)}
              y2={tenth(by)}
              stroke="rgb(220 225 250 / 60%)"
              stroke-width={s % 12 === 0 ? 2 : 1.3}
            />
          )
        }}
      </For>
      <text x={CX - R} y={CY + 18} class={styles.small} text-anchor="middle">
        root
      </text>
      <text x={CX + R} y={CY + 18} class={styles.small} text-anchor="middle">
        octave
      </text>
      <Show when={props.reveal !== null && needle().at > 0.05}>
        <g data-part="band">
          <path
            d={arcD(0, needle().at, R - 34)}
            fill="none"
            stroke={TEAL}
            stroke-width="44"
            opacity="0.18"
          />
          <path
            d={arcD(0, needle().at, R - 34)}
            fill="none"
            stroke={TEAL}
            stroke-width="11"
            stroke-linecap="round"
            opacity="0.55"
          />
        </g>
      </Show>
      <Show when={props.reveal?.wrongSemitones ?? null}>
        {(pick) => (
          <g data-part="pick">
            <Glow
              d={lineD(...at(pick(), R - 12), ...at(pick(), R + 14))}
              width={2.4}
              stroke={RED}
              opacity={named()}
            />
          </g>
        )}
      </Show>
      <Orb
        ids={ids}
        x={at(0, R)[0]}
        y={at(0, R)[1]}
        r={9}
        lit={listening() && sinceRoot() === null ? 0.4 : 1}
        glow={props.sounding === 1 ? 0.9 : 0.25}
      />
      <Ring
        x={at(0, R)[0]}
        y={at(0, R)[1]}
        t={sinceRoot() ?? -1}
        ms={600}
        from={9}
        to={30}
        width={1.8}
      />
      <g data-part="needle" data-at={tenth(needle().at)}>
        <Glow
          d={lineD(CX, CY, tip()[0], tip()[1])}
          width={2.6}
          stroke={props.reveal === null ? WHITE : TEAL_PALE}
          opacity={hundredth(needle().light)}
        />
      </g>
      <circle cx={CX} cy={CY} r="7" fill="#d5dbff" />
      <Show when={props.reveal}>
        {(reveal) => (
          <g opacity={hundredth(named())}>
            <text
              x={CX}
              y={CY - R - 44}
              class={`${styles.readout} ${styles.teal} ${styles.edged}`}
              text-anchor="middle"
              data-part="interval"
            >
              {reveal().name}
            </text>
            <text
              x={CX}
              y={CY - R - 26}
              class={styles.caption}
              text-anchor="middle"
            >
              {reveal().semitones} semitone{reveal().semitones === 1 ? '' : 's'}
            </text>
          </g>
        )}
      </Show>
    </svg>
  )
}
