// ============================================================
// Subdivide's instrument in the room: the kit's two bars on three lanes,
// hats, snare and kick (docs/plans/ear-lab-native-look.md).
//
// Each hit lands on its lane as it sounds, one step along from the last,
// with no bar lines and no accent: how the steps group is the question.
// The steps stand at one spacing whatever the metre, so the spacing says
// nothing before the ear has heard it. The reveal drops the bar lines in,
// lights beat one in each bar and draws the grouping under the kick lane:
// 7/8 as 2 + 2 + 3.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { MetreLatticeProps } from '@/features/ear-lab/MetreLattice'
import type { DrumVoiceId } from '@/lib/drum-voices'
import { metreGroups, stepMs } from '@/lib/ear/metre'
import { SUBDIVIDE_TIMING } from '@/lib/ear/timing'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import { clamp, easeOut, hundredth, lerp, lineD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, Orb, paint, Ring, TEAL_PALE } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over two rows of two pads. */
const HEIGHT = 369
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const TOP = 12
const BOTTOM = HEIGHT - 16
const FIRST_X = 74
/** One step's spacing: two bars of the longest metre, 7/8, across. */
const STEP = (352 - FIRST_X) / 13
const LANE_Y = { hat: TOP + 74, snare: TOP + 146, kick: TOP + 218 } as const
const GROUP_Y = LANE_Y.kick + 30

type Lane = keyof typeof LANE_Y

const stepX = (k: number): number => FIRST_X + k * STEP

/** Which lane a drum lands on, and how big: a sidestick is played on the
 *  snare's rim, and the cymbals ride with the hats. */
function laneOf(voice: DrumVoiceId): { lane: Lane; r: number } {
  if (voice === 'kick' || voice === 'tom-low') return { lane: 'kick', r: 11 }
  if (voice === 'snare' || voice === 'clap') return { lane: 'snare', r: 7.5 }
  if (voice === 'sidestick' || voice === 'tom-mid' || voice === 'tom-high')
    return { lane: 'snare', r: 5.5 }
  return { lane: 'hat', r: 3.6 }
}

interface Hit {
  /** From the first step of the first bar. */
  index: number
  /** Beat one of its bar. */
  one: boolean
  lane: Lane
  r: number
}

export function LitLanes(props: MetreLatticeProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const arrivals = useArrivals(() => props.lit, clock)
  const beats = (): number => props.pattern?.metre.beats ?? props.steps

  /** Every hit of the two bars, in the order they sound. */
  const hits = createMemo((): Hit[] => {
    const pattern = props.pattern
    if (!pattern) return []
    const out: Hit[] = []
    for (let bar = 0; bar < SUBDIVIDE_TIMING.bars; bar++) {
      for (const hit of pattern.steps) {
        out.push({
          index: bar * pattern.metre.beats + hit.step,
          one: hit.step === 0,
          ...laneOf(hit.voice),
        })
      }
    }
    return out.sort((a, b) => a.index - b.index)
  })

  const listening = (): boolean =>
    props.reveal === null && (props.lit > 0 || clock.beat() === 'listen')
  const revealed = (): number =>
    props.reveal === null ? 0 : easeOut(progress(clock.t(), 100, 800))
  const age = (order: number): number | null =>
    listening() ? arrivalAge(arrivals(), order, clock) : null

  /** The playhead, from the step sounding towards the next, at the pace
   *  of the last two steps. */
  const headX = (): number | null => {
    if (!listening() || props.lit <= 0) return null
    const k = arrivals().length - 1
    const since = age(k)
    if (since === null) return null
    const times = arrivals()
    const pace =
      k >= 1
        ? times[k] - times[k - 1]
        : props.pattern
          ? stepMs(props.pattern.metre, SUBDIVIDE_TIMING.quarterMs)
          : SUBDIVIDE_TIMING.quarterMs
    return stepX(k) + clamp(since / Math.max(1, pace), 0, 1) * STEP
  }

  const groups = (): number[] =>
    props.pattern ? metreGroups(props.pattern) : [beats()]
  const groupWords = (): string =>
    props.pattern?.metre.unit === 8
      ? `two bars of ${groups().join(' + ')}`
      : `two bars of ${beats()} beats`
  /** Each bracket under the kick lane: its first and last step. */
  const brackets = (): Array<{ from: number; to: number; size: number }> => {
    const out: Array<{ from: number; to: number; size: number }> = []
    for (let bar = 0; bar < SUBDIVIDE_TIMING.bars; bar++) {
      let at = bar * beats()
      for (const size of groups()) {
        out.push({ from: at, to: at + size - 1, size })
        at += size
      }
    }
    return out
  }
  const barLines = (): number[] => [
    stepX(0) - STEP / 2,
    stepX(beats()) - STEP / 2,
    stepX(SUBDIVIDE_TIMING.bars * beats() - 1) + STEP / 2,
  ]

  const label = (): string => {
    if (props.reveal !== null)
      return `The kit on three lanes: ${props.reveal.name}, ${groupWords()}`
    return listening()
      ? 'The kit on three lanes, playing'
      : 'The kit on three lanes, hats, snare and kick'
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="metre-lanes"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <rect
        x="16"
        y={TOP}
        width="358"
        height={BOTTOM - TOP}
        rx="24"
        fill={paint(ids.glass)}
        class={styles.glass}
      />
      <For each={['hat', 'snare', 'kick'] as const}>
        {(lane) => (
          <>
            <text x="30" y={LANE_Y[lane] + 4} class={styles.small}>
              {lane}
            </text>
            <line
              x1="64"
              x2="362"
              y1={LANE_Y[lane]}
              y2={LANE_Y[lane]}
              stroke="rgb(255 255 255 / 6%)"
            />
          </>
        )}
      </For>

      <Show when={props.reveal}>
        <For each={barLines()}>
          {(x) => (
            <g data-part="bar-line">
              <Glow
                d={
                  revealed() > 0.02
                    ? lineD(
                        x,
                        LANE_Y.hat - 22,
                        x,
                        LANE_Y.hat - 22 + (BOTTOM - TOP - 70) * revealed(),
                      )
                    : ''
                }
                width={2}
                stroke={TEAL_PALE}
                opacity={hundredth(revealed())}
              />
            </g>
          )}
        </For>
      </Show>

      <For each={hits()}>
        {(hit, order) => {
          const since = (): number | null => age(order())
          const light = (): { shown: number; body: number; glow: number } => {
            if (props.reveal !== null)
              return { shown: 1, body: hit.one ? 1 : 0.6, glow: 0 }
            if (!listening()) return { shown: 1, body: 0.55, glow: 0 }
            const t = since()
            if (t === null) return { shown: 0, body: 0, glow: 0 }
            return {
              shown: progress(t, 0, 160),
              body: lerp(1, 0.7, progress(t, 0, 600)),
              glow: (1 - progress(t, 0, 400)) * 0.8,
            }
          }
          return (
            <g
              opacity={hundredth(light().shown)}
              data-hit={hit.index + 1}
              data-lane={hit.lane}
              data-sounded={since() !== null ? '' : undefined}
              data-one={props.reveal !== null && hit.one ? '' : undefined}
            >
              <Orb
                ids={ids}
                x={stepX(hit.index)}
                y={LANE_Y[hit.lane]}
                r={hit.r}
                teal={props.reveal !== null && hit.one}
                lit={hundredth(light().body)}
                glow={hundredth(light().glow)}
              />
              <Ring
                x={stepX(hit.index)}
                y={LANE_Y[hit.lane]}
                t={since() ?? -1}
                ms={420}
                from={hit.r}
                to={hit.r + 16}
                width={1.6}
              />
            </g>
          )
        }}
      </For>

      <Show when={headX()}>
        {(x) => (
          <Glow
            d={lineD(x(), TOP + 50, x(), BOTTOM - 30)}
            width={1.6}
            stroke="rgb(255 255 255 / 50%)"
          />
        )}
      </Show>

      <Show when={props.reveal}>
        {(reveal) => (
          <g opacity={hundredth(revealed())}>
            <text
              x="356"
              y={TOP + 34}
              class={`${styles.readout} ${styles.teal} ${styles.edged}`}
              text-anchor="end"
              data-part="metre-name"
            >
              {reveal().name}
            </text>
            <text x="356" y={TOP + 52} class={styles.caption} text-anchor="end">
              {groupWords()}
            </text>
            <For each={brackets()}>
              {(bracket) => (
                <g data-part="grouping">
                  <Glow
                    d={`M${tenth(stepX(bracket.from) - 6)} ${GROUP_Y - 6}V${GROUP_Y}H${tenth(stepX(bracket.to) + 6)}V${GROUP_Y - 6}`}
                    width={1.2}
                    stroke={TEAL_PALE}
                  />
                  <text
                    x={tenth((stepX(bracket.from) + stepX(bracket.to)) / 2)}
                    y={GROUP_Y + 17}
                    class={`${styles.name} ${styles.teal}`}
                    text-anchor="middle"
                  >
                    {bracket.size}
                  </text>
                </g>
              )}
            </For>
          </g>
        )}
      </Show>
    </svg>
  )
}
