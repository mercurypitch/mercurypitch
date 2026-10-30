// ============================================================
// Stack's instrument in the room: the chord as a stack of lit discs over
// a rule of twelve semitones (docs/plans/ear-lab-native-look.md).
//
// While the chord sounds, four ghost discs stand at even spacing and
// ripple with it: four, whatever the chord, because the count of its
// tones would give the quality away. At the reveal the chord's own tones
// settle at their heights, named beside them, the gaps between them
// bracketed and named (m3, M3), and a ghost the chord has no tone for
// fades out.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, on, Show, untrack } from 'solid-js'
import type { GearTrainProps } from '@/features/ear-lab/GearTrain'
import { LEAP_BANK } from '@/lib/ear/banks'
import { useStageClock } from './clock'
import { easeInOut, hundredth, lerp, lineD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, paint, TEAL_PALE } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over two rows of three pads. */
const HEIGHT = 369
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const BASE = HEIGHT - 48
/** Px a semitone up the rule. */
const STEP = 19.5
const RULE_X = 58
const DISC_X = 214
const RX = 86
const RY = 12.5
/** Where the four ghosts stand while the chord sounds, in semitones. */
const GHOSTS = [2, 5, 8, 11]

/** A chord tone's name by its semitones above the root. */
const TONE: Readonly<Record<number, string>> = {
  0: 'root',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♭5',
  7: '5',
  8: '♯5',
  9: '6',
  10: '♭7',
  11: '7',
}

/** An interval's short name (m3, M3, P4) by its semitones. */
function gapName(semitones: number): string {
  return (
    LEAP_BANK.find((item) => item.payload[0] === semitones)?.label ??
    String(semitones)
  )
}

const discY = (semitones: number): number => BASE - semitones * STEP

export function LitDiscs(props: GearTrainProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  /** The chord's tones, root first, once told. */
  const tones = (): number[] =>
    props.reveal ? [0, ...props.reveal.intervals].slice(0, 4) : []
  const revealed = (): number =>
    props.reveal === null ? 0 : easeInOut(progress(clock.t(), 100, 900))

  /** When the chord began to sound, in the clock's ambient ms. */
  const [soundAt, setSoundAt] = createSignal(0)
  createEffect(
    on(
      () => props.sounding,
      (sounding) => {
        if (sounding) setSoundAt(untrack(clock.ambient))
      },
    ),
  )
  const since = (): number => clock.ambient() - soundAt()
  /** How loud the chord still rings, 0 to 1, for the glow. */
  const ringing = (): number => {
    if (props.sounding)
      return clock.reduced ? 0.7 : lerp(1, 0.35, progress(since(), 0, 1300))
    return props.reveal !== null ? 0.5 : 0.3
  }

  const label = (): string =>
    props.reveal
      ? `A stack of ${tones().length} discs: ${props.reveal.name}`
      : props.sounding
        ? 'A stack of discs, the chord sounding'
        : 'A stack of discs at rest'

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="chord-discs"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <Glow
        d={lineD(RULE_X, BASE, RULE_X, discY(12))}
        width={1.3}
        stroke="rgb(200 205 235 / 45%)"
      />
      <For each={Array.from({ length: 13 }, (_, s) => s)}>
        {(s) => (
          <line
            x1={s % 12 === 0 ? 50 : 53}
            x2={RULE_X}
            y1={tenth(discY(s))}
            y2={tenth(discY(s))}
            stroke="rgb(200 205 235 / 45%)"
          />
        )}
      </For>
      <text x="44" y={BASE + 4} class={styles.small} text-anchor="end">
        0
      </text>
      <text
        x="44"
        y={tenth(discY(12) + 4)}
        class={styles.small}
        text-anchor="end"
      >
        12
      </text>
      <text x={RULE_X} y={BASE + 22} class={styles.small} text-anchor="middle">
        semitones
      </text>

      <For each={[0, 1, 2, 3]}>
        {(i) => {
          const real = (): boolean => i < tones().length
          const y = (): number => {
            if (props.reveal === null || !real()) return discY(GHOSTS[i])
            const settle = easeInOut(
              progress(clock.t(), 100 + i * 90, 900 + i * 90),
            )
            return lerp(discY(GHOSTS[i]), discY(tones()[i]), settle)
          }
          const ripple = (): number => {
            if (!props.sounding || clock.reduced) return -1
            return ((since() + i * 140) % 700) / 700
          }
          return (
            <g
              transform={`translate(${DISC_X} ${tenth(y())})`}
              opacity={
                props.reveal !== null && !real() ? hundredth(1 - revealed()) : 1
              }
              data-disc={i + 1}
              data-tone={real() ? tones()[i] : undefined}
            >
              <ellipse
                rx={RX + 24}
                ry="22"
                fill={paint(ids.glow)}
                opacity={hundredth(ringing() * 0.8)}
              />
              <ellipse
                rx={RX}
                ry={RY}
                fill={paint(ids.across)}
                opacity={hundredth(
                  props.reveal !== null && real()
                    ? 0.9
                    : 0.35 + ringing() * 0.55,
                )}
              />
              <ellipse
                rx={RX}
                ry={RY}
                fill="none"
                stroke={
                  props.reveal !== null && real()
                    ? TEAL_PALE
                    : 'rgb(255 255 255 / 55%)'
                }
                stroke-width="1.3"
              />
              <Show when={ripple() >= 0}>
                <ellipse
                  rx={tenth(RX + 30 * ripple())}
                  ry={tenth(RY + 8 * ripple())}
                  fill="none"
                  stroke="var(--room-a, #9a87f0)"
                  stroke-width="1.4"
                  opacity={hundredth((1 - ripple()) * 0.6 * ringing())}
                />
              </Show>
            </g>
          )
        }}
      </For>

      <Show when={props.reveal}>
        {(reveal) => (
          <g opacity={hundredth(revealed())}>
            <For each={tones()}>
              {(tone) => (
                <text
                  x={DISC_X + RX + 12}
                  y={tenth(discY(tone) + 5)}
                  class={`${styles.name} ${styles.teal} ${styles.edged}`}
                  data-part="tone"
                >
                  {TONE[tone] ?? String(tone)}
                </text>
              )}
            </For>
            <For each={tones().slice(1)}>
              {(tone, k) => {
                const below = (): number => tones()[k()]
                const ya = (): number => discY(below())
                const yb = (): number => discY(tone)
                return (
                  <g data-part="gap">
                    <Glow
                      d={`M${DISC_X - RX - 8} ${tenth(ya() - 3)}h-8V${tenth(yb() + 3)}h8`}
                      width={1.2}
                      stroke={TEAL_PALE}
                    />
                    <text
                      x={DISC_X - RX - 22}
                      y={tenth((ya() + yb()) / 2 + 4)}
                      class={`${styles.caption} ${styles.teal}`}
                      text-anchor="end"
                    >
                      {gapName(tone - below())}
                    </text>
                  </g>
                )
              }}
            </For>
            <text
              x="360"
              y="24"
              class={`${styles.readout} ${styles.teal} ${styles.edged}`}
              text-anchor="end"
              data-part="quality"
            >
              {reveal().name}
            </text>
          </g>
        )}
      </Show>
    </svg>
  )
}
