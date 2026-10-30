// ============================================================
// The desk's instrument in the room: a row of glass channel strips
// (docs/plans/ear-lab-native-look.md), for Color, Critique and Weight.
//
// While a render plays the strips' levels move alike, so the drawing
// says nothing of which band was boosted or which fault is in; when a
// drill compares renders, the strip of the one sounding is edged in the
// station's light and only it moves. At the reveal the answer's strip is
// edged teal and a wrong pick's dashed red. Color's boost lifts an EQ
// bell over its band, with the boost written over it; the other drills'
// answers are named over their strip.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { MixingDeskProps } from '@/features/ear-lab/MixingDesk'
import { useStageClock } from './clock'
import type { Point } from './draw'
import { clamp, easeInOut, hundredth, polyD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, paint, RED, TEAL, TEAL_PALE } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over two rows of three pads. */
const HEIGHT = 369
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const TOP = 120
const BOTTOM = HEIGHT - 58
const CURVE_Y = 96
/** A strip's spacing, the six of Color across the stage. */
const SPACING = 60
/** How high the bell lifts over its band. */
const BELL = 58

export function LitDesk(props: MixingDeskProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const count = (): number => Math.max(1, props.labels.length)
  const stripX = (i: number): number => 195 + (i - (count() - 1) / 2) * SPACING
  const revealed = (): number =>
    props.reveal === null ? 0 : easeInOut(progress(clock.t(), 150, 750))

  /** A strip's level, 0 to 1: alike at rest, moving while it plays. */
  const level = (i: number): number => {
    const moving =
      props.reveal === null &&
      props.playing &&
      (props.highlight === 0 || props.highlight === i + 1)
    if (!moving || clock.reduced) return 0.42
    const at = clock.ambient()
    return (
      0.5 +
      0.17 * Math.sin(at * 0.0047 + i * 1.9) +
      0.09 * Math.sin(at * 0.012 + i * 0.7)
    )
  }

  const lifted = (): boolean =>
    props.reveal !== null && props.reveal.lift !== undefined
  const curveD = (): string => {
    const lift = lifted() ? revealed() : 0
    const at = props.reveal === null ? 0 : stripX(props.reveal.index)
    const points: Point[] = []
    for (let x = 18; x <= 372; x += 6) {
      points.push([
        x,
        CURVE_Y - BELL * lift * Math.exp(-Math.pow((x - at) / 32, 2)),
      ])
    }
    return polyD(points)
  }
  const wordsX = (): number =>
    props.reveal === null ? 195 : clamp(stripX(props.reveal.index), 96, 294)

  const label = (): string => {
    const reveal = props.reveal
    if (reveal !== null) {
      return `The desk's ${count()} strips: ${reveal.name}${
        reveal.lift === undefined ? '' : `, ${reveal.lift}`
      }`
    }
    if (props.highlight > 0)
      return `The desk's ${count()} strips, the ${props.labels[props.highlight - 1] ?? ''} playing`
    return props.playing
      ? `The desk's ${count()} strips, the mix playing`
      : `The desk's ${count()} strips at rest`
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="desk-strips"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <text x="18" y={CURVE_Y - 14} class={styles.small}>
        EQ
      </text>
      <line
        x1="18"
        x2="372"
        y1={CURVE_Y}
        y2={CURVE_Y}
        stroke="rgb(255 255 255 / 8%)"
        stroke-dasharray="2 5"
      />
      <For each={props.labels}>
        {(name, i) => {
          const x = (): number => stripX(i())
          const fillH = (): number => tenth((BOTTOM - TOP - 10) * level(i()))
          const answer = (): boolean => props.reveal?.index === i()
          const picked = (): boolean =>
            props.reveal !== null && props.reveal.picked === i()
          const sounding = (): boolean =>
            props.reveal === null && props.highlight === i() + 1
          return (
            <g
              data-strip={i() + 1}
              data-answer={answer() ? '' : undefined}
              data-picked={picked() ? '' : undefined}
              data-sounding={sounding() ? '' : undefined}
            >
              <rect
                x={tenth(x() - 18)}
                y={TOP}
                width="36"
                height={BOTTOM - TOP}
                rx="18"
                fill={paint(ids.glass)}
                stroke="rgb(255 255 255 / 12%)"
              />
              <rect
                x={tenth(x() - 13)}
                y={tenth(BOTTOM - 5 - fillH())}
                width="26"
                height={fillH()}
                rx="13"
                fill={paint(ids.down)}
                opacity={props.playing && props.reveal === null ? 0.95 : 0.6}
              />
              <Show when={answer() || picked() || sounding()}>
                <rect
                  x={tenth(x() - 18)}
                  y={TOP}
                  width="36"
                  height={BOTTOM - TOP}
                  rx="18"
                  fill="none"
                  stroke={
                    sounding()
                      ? 'var(--room-a, #9a87f0)'
                      : answer()
                        ? TEAL
                        : RED
                  }
                  stroke-width="2"
                  stroke-dasharray={picked() ? '5 4' : undefined}
                  opacity={sounding() ? 1 : hundredth(revealed())}
                />
              </Show>
              <text
                x={tenth(x())}
                y={BOTTOM + 22}
                class={styles.caption}
                text-anchor="middle"
              >
                {name}
              </text>
            </g>
          )
        }}
      </For>
      <Glow
        d={curveD()}
        width={2.2}
        stroke={props.reveal === null ? paint(ids.across) : TEAL_PALE}
      />
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x={tenth(wordsX())}
            y={CURVE_Y - 68}
            class={`${styles.number} ${styles.teal} ${styles.edged}`}
            text-anchor="middle"
            opacity={hundredth(revealed())}
            data-part="lift"
          >
            {reveal().lift ?? reveal().name}
          </text>
        )}
      </Show>
    </svg>
  )
}
