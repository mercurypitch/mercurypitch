// ============================================================
// The Pull's instrument in the room: the cadence's four lamps, then a
// beam of light on a fulcrum with a pan for each note
// (docs/plans/ear-lab-native-look.md).
//
// Each pan lights and rings as its note sounds, and the beam stays level:
// which note leans harder is the question. At the reveal the beam tips
// toward it, its pan turns teal with an arrow the way it leans, and each
// pan's note is named under it: "Ti leaning to Do′", "Mi at rest".
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, on, Show, untrack } from 'solid-js'
import type { PullBeamProps } from '@/features/ear-lab/PullBeam'
import { useArrivals, useStageClock } from './clock'
import { clamp, easeInOut, hundredth, lineD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, Orb, paint, Ring, TEAL_PALE } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over the big pair of pads. */
const HEIGHT = 409
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const CADENCE = ['I', 'IV', 'V', 'I']
const LAMP_W = 50
const LAMP_GAP = 10
const PIVOT_X = 195
const PIVOT_Y = Math.round(HEIGHT * 0.47)
const HALF = 132
/** The tip at the reveal, in degrees. */
const TIP = 10
const LAMP_MS = 460

export function LitBeam(props: PullBeamProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const chords = useArrivals(() => props.cadence ?? 0, clock)
  /** When each pan's note last began, in the clock's ambient ms. */
  const [sounded, setSounded] = createSignal<readonly (number | null)[]>([
    null,
    null,
  ])
  createEffect(
    on(
      () => props.sounding,
      (pan) => {
        if (pan === 0) return
        const at = untrack(clock.ambient)
        setSounded((list) => (pan === 1 ? [at, null] : [list[0], at]))
      },
    ),
  )
  // A new question: the pans go dark again with the cadence.
  createEffect(
    on(
      () => props.cadence ?? 0,
      (step) => {
        if (step === 1) setSounded([null, null])
      },
    ),
  )

  const listening = (): boolean =>
    props.reveal === null && clock.beat() === 'listen'
  const revealed = (): number =>
    props.reveal === null ? 0 : easeInOut(progress(clock.t(), 100, 700))
  const lampLight = (j: number): number => {
    if (!listening()) return 0.35
    const times = chords()
    if (j >= times.length) return 0
    if (clock.reduced) return props.cadence === j + 1 ? 1 : 0.35
    return clock.ambient() - times[j] < LAMP_MS ? 1 : 0.35
  }
  const tilt = (): number =>
    props.reveal === null
      ? 0
      : ((props.reveal.side === 2 ? 1 : -1) * TIP * revealed() * Math.PI) / 180
  /** A pan's end of the beam. */
  const end = (pan: 0 | 1): { x: number; y: number } => {
    const sign = pan === 0 ? -1 : 1
    return {
      x: PIVOT_X + sign * HALF * Math.cos(tilt()),
      y: PIVOT_Y + sign * HALF * Math.sin(tilt()),
    }
  }
  const since = (pan: 0 | 1): number | null => {
    const at = sounded()[pan]
    if (at === null || at === undefined) return null
    return clock.reduced ? 0 : Math.max(0, clock.ambient() - at)
  }

  const label = (): string => {
    const reveal = props.reveal
    if (reveal !== null)
      return `A beam tipped toward the ${reveal.side === 1 ? 'first' : 'second'} note: ${reveal.word}${reveal.rest === undefined || reveal.rest === '' ? '' : `; ${reveal.rest}`}`
    if (props.sounding > 0)
      return `A beam with two pans, the ${props.sounding === 1 ? 'first' : 'second'} note sounding`
    return 'A beam with two pans, level'
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="pull-beam"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <For each={CADENCE}>
        {(chord, j) => {
          const x = (): number =>
            PIVOT_X -
            (CADENCE.length * LAMP_W + (CADENCE.length - 1) * LAMP_GAP) / 2 +
            j() * (LAMP_W + LAMP_GAP)
          const q = (): number => lampLight(j())
          return (
            <g data-part="cadence-lamp" data-lit={q() === 1 ? '' : undefined}>
              <rect
                x={x()}
                y="10"
                width={LAMP_W}
                height="26"
                rx="13"
                fill={`color-mix(in srgb, var(--room-a, #9a87f0) ${Math.round(8 + 40 * q())}%, transparent)`}
                stroke={
                  q() > 0
                    ? `color-mix(in srgb, var(--room-a, #9a87f0) ${Math.round(40 + 50 * q())}%, transparent)`
                    : 'rgb(255 255 255 / 14%)'
                }
              />
              <text
                x={x() + LAMP_W / 2}
                y="27.5"
                class={styles.name}
                text-anchor="middle"
              >
                {chord}
              </text>
            </g>
          )
        }}
      </For>

      <path
        d={`M${PIVOT_X} ${PIVOT_Y + 4}L${PIVOT_X - 28} ${PIVOT_Y + 60}H${PIVOT_X + 28}Z`}
        fill={paint(ids.glass)}
        stroke="rgb(255 255 255 / 22%)"
      />
      <line
        x1={PIVOT_X - 70}
        x2={PIVOT_X + 70}
        y1={PIVOT_Y + 60}
        y2={PIVOT_Y + 60}
        stroke="rgb(255 255 255 / 14%)"
      />
      <Glow
        d={lineD(end(0).x, end(0).y, end(1).x, end(1).y)}
        width={3.2}
        stroke={props.reveal === null ? paint(ids.across) : TEAL_PALE}
      />
      <For each={[0, 1] as const}>
        {(pan) => {
          const leaning = (): boolean => props.reveal?.side === pan + 1
          const sounding = (): boolean => props.sounding === pan + 1
          const light = (): { body: number; glow: number } => {
            if (sounding()) return { body: 1, glow: 0.9 }
            if (props.reveal !== null || !listening())
              return { body: 0.65, glow: 0.12 }
            return since(pan) === null
              ? { body: 0.3, glow: 0.12 }
              : { body: 0.65, glow: 0.12 }
          }
          const x = (): number => end(pan).x
          const y = (): number => end(pan).y
          return (
            <g
              data-pan={pan + 1}
              data-sounding={sounding() ? '' : undefined}
              data-leaning={props.reveal !== null && leaning() ? '' : undefined}
            >
              <line
                x1={tenth(x())}
                x2={tenth(x())}
                y1={tenth(y())}
                y2={tenth(y() + 34)}
                stroke="rgb(255 255 255 / 35%)"
                stroke-width="1.2"
              />
              <Orb
                ids={ids}
                x={x()}
                y={y() + 60}
                r={26}
                teal={props.reveal !== null && leaning()}
                lit={light().body}
                glow={light().glow}
              />
              <Ring
                x={x()}
                y={y() + 60}
                t={sounding() ? (since(pan) ?? -1) : -1}
                ms={600}
                from={26}
                to={50}
                width={1.8}
              />
              <text
                x={tenth(x())}
                y={tenth(y() + 108)}
                class={styles.name}
                text-anchor="middle"
              >
                {pan === 0 ? 'First' : 'Second'}
              </text>
              <Show when={props.reveal}>
                {(reveal) => (
                  <>
                    <text
                      x={tenth(clamp(x(), 86, 304))}
                      y={tenth(y() + 128)}
                      class={`${leaning() ? `${styles.name} ${styles.teal}` : styles.label} ${styles.edged}`}
                      text-anchor="middle"
                      opacity={hundredth(revealed())}
                      data-part="pan-words"
                    >
                      {leaning() ? reveal().word : (reveal().rest ?? '')}
                    </text>
                    <Show when={leaning()}>
                      <Glow
                        d={
                          reveal().toward === 'down'
                            ? `M${tenth(x() + 34)} ${tenth(y() + 46)}v26M${tenth(x() + 28)} ${tenth(y() + 66)}l6 6l6 -6`
                            : `M${tenth(x() + 34)} ${tenth(y() + 72)}v-26M${tenth(x() + 28)} ${tenth(y() + 52)}l6 -6l6 6`
                        }
                        width={2}
                        stroke={TEAL_PALE}
                        opacity={revealed()}
                      />
                    </Show>
                  </>
                )}
              </Show>
            </g>
          )
        }}
      </For>
      <circle cx={PIVOT_X} cy={PIVOT_Y} r="5" fill="#d5dbff" />
    </svg>
  )
}
