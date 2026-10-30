// ============================================================
// Cadence's instrument in the room: one orb of light per chord, in a row
// at one height (docs/plans/ear-lab-native-look.md).
//
// While the progression plays each orb strums in its turn, every orb the
// same, so nothing in the drawing says which chord is which. At the
// reveal each orb lifts to its root on the scale's seven lines, takes its
// numeral, and the motion between them is drawn; the progression is
// named over it.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ProgressionTrainProps } from '@/features/ear-lab/ProgressionTrain'
import { romanOf } from '@/lib/ear/progressions'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import type { Point } from './draw'
import { easeOut, easeOutBack, hundredth, lerp, polyD, progress, smoothD, tenth, } from './draw'
import { Glow, LitDefs, litIds, Orb, paint, Ring, TEAL_PALE } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over two rows of two pads. */
const HEIGHT = 369
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const LEVEL = Math.round(HEIGHT * 0.47)
const R = 27
/** An orb's spacing, the four of a progression across the stage. */
const SPACING = 87
/** How long an orb strums once its chord starts. */
const STRUM_MS = 600

/** Where the scale's degree `d` (1 to 7) stands. */
const degreeY = (d: number): number => HEIGHT - 66 - (d - 1) * 30

export function LitOrbs(props: ProgressionTrainProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const arrivals = useArrivals(() => props.sounding, clock)
  const count = (): number =>
    Math.max(1, props.reveal?.degrees.length ?? props.count)
  const orbX = (k: number): number =>
    200.5 - ((count() - 1) * SPACING) / 2 + k * SPACING
  const revealed = (): number =>
    props.reveal === null ? 0 : easeOut(progress(clock.t(), 100, 700))

  const age = (k: number): number | null =>
    props.reveal === null ? arrivalAge(arrivals(), k, clock) : null
  const strumming = (k: number): boolean => {
    const since = age(k)
    return props.sounding === k + 1 && since !== null && since < STRUM_MS
  }
  const orbY = (k: number): number => {
    const degree = props.reveal?.degrees[k]
    if (degree === undefined) return LEVEL
    const lift = easeOutBack(progress(clock.t(), 80 + k * 80, 600 + k * 80))
    return lerp(LEVEL, degreeY(degree), lift)
  }
  const pathD = (): string => {
    const points: Point[] = Array.from({ length: count() }, (_, k) => [
      orbX(k),
      orbY(k),
    ])
    return props.reveal === null ? polyD(points) : smoothD(points)
  }

  const label = (): string =>
    props.reveal
      ? `${count()} chord orbs lifted to their roots: ${props.reveal.name}`
      : props.sounding > 0
        ? `${count()} chord orbs, chord ${props.sounding} sounding`
        : `${count()} chord orbs at rest`

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="chord-orbs"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <For each={[1, 2, 3, 4, 5, 6, 7]}>
        {(degree) => (
          <line
            x1="34"
            x2="362"
            y1={degreeY(degree)}
            y2={degreeY(degree)}
            stroke="rgb(255 255 255 / 5%)"
          />
        )}
      </For>
      <Glow
        d={pathD()}
        width={2.2}
        stroke={props.reveal === null ? paint(ids.across) : TEAL_PALE}
        opacity={props.reveal === null ? 0.35 : 0.95}
      />
      <For each={Array.from({ length: count() }, (_, k) => k)}>
        {(k) => {
          const light = (): { body: number; glow: number } => {
            if (props.reveal !== null) return { body: 1, glow: 0.35 }
            if (clock.beat() !== 'listen' && props.sounding === 0)
              return { body: 0.6, glow: 0.1 }
            if (age(k) === null) return { body: 0.4, glow: 0.1 }
            return props.sounding === k + 1
              ? { body: 1, glow: 0.9 }
              : { body: 0.7, glow: 0.1 }
          }
          const strum = (): number => {
            const since = age(k)
            return since === null ? 0 : since / STRUM_MS
          }
          return (
            <g
              data-orb={k + 1}
              data-sounding={props.sounding === k + 1 ? '' : undefined}
            >
              <Orb
                ids={ids}
                x={orbX(k)}
                y={orbY(k)}
                r={R}
                teal={props.reveal !== null}
                lit={hundredth(light().body)}
                glow={hundredth(light().glow)}
              />
              <Show when={strumming(k) && !clock.reduced}>
                <g
                  transform={`translate(${tenth(orbX(k))} ${tenth(orbY(k))})`}
                  opacity={hundredth(1 - strum() * 0.6)}
                >
                  <For each={[0, 1, 2, 3]}>
                    {(string) => {
                      const x = (): number =>
                        tenth(
                          -13 +
                            string * 8.6 +
                            Math.sin(strum() * 40 + string) * 1.6,
                        )
                      return (
                        <line
                          x1={x()}
                          x2={x()}
                          y1="-14"
                          y2="14"
                          stroke="rgb(255 255 255 / 90%)"
                          stroke-width="1.4"
                          stroke-linecap="round"
                        />
                      )
                    }}
                  </For>
                </g>
              </Show>
              <Ring
                x={orbX(k)}
                y={LEVEL}
                t={age(k) ?? -1}
                ms={STRUM_MS}
                from={R}
                to={50}
                width={1.8}
              />
              <Show when={props.reveal}>
                {(reveal) => (
                  <text
                    x={tenth(orbX(k))}
                    y={tenth(orbY(k) + 6.5)}
                    class={styles.numeral}
                    text-anchor="middle"
                    opacity={hundredth(revealed())}
                    data-part="numeral"
                  >
                    {romanOf(reveal().degrees[k] ?? 1)}
                  </text>
                )}
              </Show>
            </g>
          )
        }}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="195"
            y="26"
            class={`${styles.readout} ${styles.teal} ${styles.edged}`}
            text-anchor="middle"
            opacity={hundredth(revealed())}
            data-part="progression"
          >
            {reveal().name}
          </text>
        )}
      </Show>
    </svg>
  )
}
