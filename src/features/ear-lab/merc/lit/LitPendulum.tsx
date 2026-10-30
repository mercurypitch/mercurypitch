// ============================================================
// Drift's instrument in the room: a pendulum over a train of beads
// (docs/plans/ear-lab-native-look.md).
//
// The beads stand evenly spaced, and each lights as its click sounds; the
// pendulum ticks with the clicks, passing upright on each one, so the eye
// sees the train the ear hears and nothing it does not. At the reveal the
// drifted beads slide the way the tempo went (drawn to show the way, not
// to scale: the words say how far), the tempo line bends up for a train
// that gained and down for one that lost, and the arm leans with it.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { MetronomeColumnProps } from '@/features/ear-lab/MetronomeColumn'
import { DRIFT_TIMING } from '@/lib/ear/timing'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import { clamp, easeInOut, easeOut, hundredth, lerp, lineD, progress, tenth, } from './draw'
import { Glow, LitDefs, litIds, Orb, paint, Ring, TEAL_PALE } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over a row of three pads. */
const HEIGHT = 421
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const PIVOT_X = 195
const PIVOT_Y = 24
const ARM = 160
const BEAD_Y = 261
const BEADS_LEFT = 34
const BEADS_RIGHT = 356
const BRACKET_Y = BEAD_Y + 28
const TEMPO_Y = BEAD_Y + 86
/** Degrees either way of upright while the clicks play, and the lean at
 *  the reveal. */
const SWING = 15
const LEAN = 9
/** The swing's dashed arc, in radians either way. */
const ARC = 0.28
/** How far the tempo line bends at its far end. */
const BEND = 32

const NUMBER_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
]
const say = (n: number): string => NUMBER_WORDS[n] ?? String(n)

export function LitPendulum(props: MetronomeColumnProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const arrivals = useArrivals(() => props.lit, clock)
  const beads = (): number[] =>
    Array.from({ length: Math.max(1, props.count) }, (_, i) => i)
  const spacing = (): number =>
    props.count <= 1 ? 0 : (BEADS_RIGHT - BEADS_LEFT) / (props.count - 1)
  const beadX = (i: number): number => BEADS_LEFT + i * spacing()

  /** The clicks are playing: the train is the listen beat's. */
  const listening = (): boolean =>
    props.reveal === null && (props.lit > 0 || clock.beat() === 'listen')
  const revealed = (): number =>
    props.reveal === null ? 0 : easeInOut(progress(clock.t(), 200, 1000))
  const way = (): 1 | -1 | 0 =>
    props.reveal?.way === 'faster' ? 1 : props.reveal?.way === 'slower' ? -1 : 0

  const age = (i: number): number | null =>
    listening() ? arrivalAge(arrivals(), i, clock) : null
  const latest = (): number => arrivals().length - 1

  /** Upright on each click and out to the side between them, the swing
   *  timed by the last two clicks so it keeps with the train; the last
   *  click's swing dies away. Leaning at the reveal. */
  const angle = (): number => {
    if (props.reveal !== null) return way() * LEAN * revealed()
    const k = latest()
    const since = age(k)
    if (since === null) return 0
    const times = arrivals()
    const interval = k >= 1 ? times[k] - times[k - 1] : DRIFT_TIMING.periodMs
    const swung = clamp(since / Math.max(1, interval), 0, 1)
    const dying =
      k >= props.count - 1 ? 1 - easeOut(progress(since, 0, 240)) : 1
    return SWING * Math.sin(Math.PI * (k + swung)) * dying
  }
  const flash = (): boolean => {
    const since = age(latest())
    return since !== null && since < 140
  }

  /** Where a drifted bead slides to: each step after the steady ones a
   *  little shorter for a train that gained, longer for one that lost. */
  const slidTo = (i: number): number => {
    if (i < props.steady || way() === 0) return beadX(i)
    let x = beadX(props.steady - 1)
    for (let j = props.steady; j <= i; j++) {
      const step = j - props.steady + 1
      x += spacing() * (way() === 1 ? 1 - 0.034 * step : 1 + 0.02 * step)
    }
    return x
  }

  const bend = (): number => -way() * BEND * revealed()
  const tempoD = (): string => {
    const from = beadX(props.steady - 1)
    const c1 = beadX(props.steady + 1)
    const c2 = beadX(props.steady + 3)
    return `M24 ${TEMPO_Y}L${tenth(from)} ${TEMPO_Y}C${tenth(c1)} ${TEMPO_Y} ${tenth(c2)} ${tenth(TEMPO_Y + bend() * 0.8)} 366 ${tenth(TEMPO_Y + bend())}`
  }
  const tempoWord = (): string => {
    const reveal = props.reveal
    if (reveal === null) return ''
    if (reveal.way === 'steady') return 'Held steady'
    return `${reveal.way === 'faster' ? 'Gained' : 'Lost'} ${reveal.percent}%`
  }

  const label = (): string => {
    const reveal = props.reveal
    if (reveal !== null) {
      return `A pendulum over ${say(props.count)} beads: the tempo ${
        reveal.way === 'steady'
          ? 'held steady'
          : `${reveal.way === 'faster' ? 'gained' : 'lost'} ${reveal.percent} percent`
      }`
    }
    return props.lit > 0
      ? `A pendulum over ${say(props.count)} beads, click ${props.lit} of ${props.count}`
      : `A pendulum over ${say(props.count)} beads at rest`
  }

  const arcX = Math.sin(ARC) * ARM
  const arcY = PIVOT_Y + Math.cos(ARC) * ARM

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="drift-pendulum"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <path
        d={`M${tenth(PIVOT_X - arcX)} ${tenth(arcY)}A${ARM} ${ARM} 0 0 0 ${tenth(PIVOT_X + arcX)} ${tenth(arcY)}`}
        fill="none"
        stroke="rgb(255 255 255 / 12%)"
        stroke-width="1.2"
        stroke-dasharray="2 6"
      />
      <g
        transform={`rotate(${tenth(angle())} ${PIVOT_X} ${PIVOT_Y})`}
        data-part="arm"
        data-angle={tenth(angle())}
      >
        <Glow
          d={lineD(PIVOT_X, PIVOT_Y, PIVOT_X, PIVOT_Y + ARM)}
          width={2.4}
          stroke={paint(ids.down)}
        />
        <Orb
          ids={ids}
          x={PIVOT_X}
          y={PIVOT_Y + ARM}
          r={15}
          glow={flash() ? 0.9 : 0.25}
        />
      </g>
      <circle cx={PIVOT_X} cy={PIVOT_Y} r="5" fill="#d5dbff" />

      <line
        x1="24"
        x2="366"
        y1={BEAD_Y}
        y2={BEAD_Y}
        stroke="rgb(255 255 255 / 9%)"
      />
      <For each={beads()}>
        {(i) => {
          const drifted = (): boolean =>
            props.reveal !== null && i >= props.steady
          const light = (): { body: number; glow: number } => {
            if (props.reveal !== null) return { body: 0.9, glow: 0 }
            if (!listening()) return { body: 0.5, glow: 0 }
            const since = age(i)
            if (since === null) return { body: 0.3, glow: 0 }
            const p = progress(since, 0, 500)
            return { body: lerp(1, 0.55, p), glow: (1 - p) * 0.7 }
          }
          return (
            <g
              data-bead={i + 1}
              data-sounded={age(i) !== null ? '' : undefined}
              data-drifted={drifted() ? '' : undefined}
            >
              <Show when={drifted()}>
                <circle
                  cx={tenth(beadX(i))}
                  cy={BEAD_Y}
                  r="9"
                  fill="none"
                  stroke="rgb(255 255 255 / 35%)"
                  stroke-dasharray="2 3"
                  opacity={hundredth(revealed() * 0.9)}
                />
              </Show>
              <Orb
                ids={ids}
                x={
                  props.reveal === null
                    ? beadX(i)
                    : lerp(beadX(i), slidTo(i), revealed())
                }
                y={BEAD_Y}
                r={9}
                teal={drifted()}
                lit={hundredth(light().body)}
                glow={hundredth(light().glow)}
              />
              <Ring
                x={beadX(i)}
                y={BEAD_Y}
                t={age(i) ?? -1}
                ms={480}
                from={9}
                to={26}
                width={1.6}
              />
            </g>
          )
        }}
      </For>

      <Glow
        d={`M${tenth(beadX(0) - 9)} ${BRACKET_Y - 7}V${BRACKET_Y}H${tenth(beadX(props.steady - 1) + 9)}V${BRACKET_Y - 7}`}
        width={1.1}
        stroke="rgb(200 205 235 / 38%)"
      />
      <text
        x={tenth((beadX(0) + beadX(props.steady - 1)) / 2)}
        y={BRACKET_Y + 19}
        class={styles.caption}
        text-anchor="middle"
      >
        {say(props.steady)} steady
      </text>
      <Glow
        d={`M${tenth(beadX(props.steady) - 9)} ${BRACKET_Y - 7}V${BRACKET_Y}H${tenth(beadX(props.count - 1) + 9)}V${BRACKET_Y - 7}`}
        width={1.1}
        stroke="rgb(200 205 235 / 38%)"
      />
      <text
        x={tenth((beadX(props.steady) + beadX(props.count - 1)) / 2)}
        y={BRACKET_Y + 19}
        class={styles.caption}
        text-anchor="middle"
      >
        then {say(props.count - props.steady)} more
      </text>

      <text x="24" y={TEMPO_Y - 12} class={styles.small}>
        tempo
      </text>
      <Glow
        d={tempoD()}
        width={2}
        stroke={props.reveal === null ? paint(ids.across) : TEAL_PALE}
      />
      <Show when={props.reveal}>
        <text
          x="366"
          y={tenth(TEMPO_Y + bend() + (bend() < 0 ? 24 : -14))}
          class={`${styles.name} ${styles.teal} ${styles.edged}`}
          text-anchor="end"
          opacity={hundredth(revealed())}
          data-part="tempo-word"
        >
          {tempoWord()}
        </text>
      </Show>
    </svg>
  )
}
