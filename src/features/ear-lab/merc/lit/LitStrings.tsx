// ============================================================
// Beat Hunt's instrument in the room: two pairs of tones as two strings
// of light, one glass panel each (docs/plans/ear-lab-native-look.md).
//
// While a pair sounds, its two strings swing together in the station's
// two lights, and the other pair rests; both pairs look alike, because
// the wobble is the question. At the reveal the beating pair falls in
// and out of step: its string swells and fades at the beat rate, its
// outline drawn about it, and the rate is written beside it in teal; the
// other pair is said to be in tune.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { BeatPendulumsProps } from '@/features/ear-lab/BeatPendulums'
import { beatWord } from '@/lib/ear/beat'
import { useStageClock } from './clock'
import { easeOut, lerp, progress, sineD, tenth } from './draw'
import { Glow, LitDefs, litIds, paint, STAGE_W } from './kit'
import styles from './lit.module.css'

const HEIGHT = 400
const GAP = 18
const PANEL_H = (HEIGHT - 24 - GAP) / 2
const LEFT = 34
const RIGHT = STAGE_W - 34
const WAVELENGTH = 26

export function LitStrings(props: BeatPendulumsProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const revealed = (): number =>
    props.reveal === null ? 0 : easeOut(progress(clock.t(), 120, 800))

  const label = (): string =>
    props.reveal !== null
      ? `Two strings of light: the ${props.reveal.pair === 1 ? 'first' : 'second'} pair was beating, ${beatWord(props.reveal.rateHz)}`
      : props.sounding > 0
        ? `Two strings of light, the ${props.sounding === 1 ? 'first' : 'second'} pair sounding`
        : 'Two strings of light at rest'

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 ${STAGE_W} ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="beat-strings"
    >
      <LitDefs ids={ids} height={HEIGHT} />
      <For each={[1, 2] as const}>
        {(pair) => {
          const top = 12 + (pair - 1) * (PANEL_H + GAP)
          const mid = top + PANEL_H / 2 + 10
          const sounding = () => props.sounding === pair
          const beating = () => props.reveal?.pair === pair
          const moving = () => sounding() || props.reveal !== null
          const phase = () => (moving() ? clock.ambient() * 0.011 : 0.8)
          /** The beat's swell along the string, at the reveal: the two
           *  tones in and out of step, the envelope travelling on. */
          const envelope = (x: number): number => {
            const rate = props.reveal?.rateHz ?? 0
            const seconds = clock.ambient() / 1000
            return (
              0.12 +
              0.88 *
                Math.abs(
                  Math.cos(
                    Math.PI * rate * seconds -
                      ((x - LEFT) / (RIGHT - LEFT)) * Math.PI * 1.5,
                  ),
                )
            )
          }
          const amplitude = (): number => {
            if (beating()) return lerp(12, 30, revealed())
            if (sounding()) return 28
            if (props.reveal !== null) return lerp(12, 22, revealed())
            return clock.beat() === 'listen' ? 3 : 12
          }
          const outline = (side: -1 | 1): string => {
            let d = ''
            for (let k = 0; k <= 60; k++) {
              const x = LEFT + ((RIGHT - LEFT) * k) / 60
              const a = amplitude() * envelope(x) + 3
              d += `${k === 0 ? 'M' : 'L'}${tenth(x)} ${tenth(mid + side * a)}`
            }
            return d
          }
          return (
            <g
              data-pair={pair}
              data-sounding={sounding() ? '' : undefined}
              data-beating={beating() ? '' : undefined}
            >
              <rect
                x="16"
                y={top}
                width={STAGE_W - 32}
                height={PANEL_H}
                rx="24"
                fill={paint(ids.glass)}
                class={styles.glass}
              />
              <text x={LEFT} y={top + 30} class={styles.name}>
                {pair === 1 ? 'Pair 1' : 'Pair 2'}
              </text>
              <circle
                cx={STAGE_W - 38}
                cy={top + 25}
                r="5.5"
                fill={sounding() ? '#9fe6ff' : 'rgb(255 255 255 / 16%)'}
              />
              <line
                x1={LEFT}
                x2={RIGHT}
                y1={mid}
                y2={mid}
                class={styles.faint}
              />
              <Show
                when={beating()}
                fallback={
                  <>
                    <Glow
                      d={sineD(
                        LEFT,
                        RIGHT,
                        mid,
                        amplitude(),
                        WAVELENGTH,
                        phase(),
                      )}
                      width={2.1}
                      stroke="var(--room-a, #9a87f0)"
                      opacity={moving() ? 1 : 0.55}
                    />
                    <Glow
                      d={sineD(
                        LEFT,
                        RIGHT,
                        mid,
                        amplitude(),
                        WAVELENGTH,
                        phase() + 0.12,
                      )}
                      width={2.1}
                      stroke="var(--room-b, #5d8cff)"
                      opacity={moving() ? 0.7 : 0.35}
                    />
                  </>
                }
              >
                <Glow
                  d={sineD(
                    LEFT,
                    RIGHT,
                    mid,
                    amplitude(),
                    WAVELENGTH,
                    phase(),
                    envelope,
                  )}
                  width={2.1}
                  stroke="var(--room-a, #9a87f0)"
                />
                <Glow
                  d={outline(-1)}
                  width={1.1}
                  stroke="rgb(255 255 255 / 45%)"
                  opacity={0.9 * revealed()}
                  dash="3 5"
                />
                <Glow
                  d={outline(1)}
                  width={1.1}
                  stroke="rgb(255 255 255 / 45%)"
                  opacity={0.9 * revealed()}
                  dash="3 5"
                />
              </Show>
              <Show when={props.reveal}>
                {(reveal) => (
                  <text
                    x={RIGHT}
                    y={top + PANEL_H - 16}
                    class={`${beating() ? `${styles.name} ${styles.teal}` : styles.caption} ${styles.edged}`}
                    text-anchor="end"
                    opacity={revealed()}
                    data-part="rate"
                  >
                    {beating()
                      ? `Beating · ${beatWord(reveal().rateHz)}`
                      : 'In tune'}
                  </text>
                )}
              </Show>
            </g>
          )
        }}
      </For>
    </svg>
  )
}
