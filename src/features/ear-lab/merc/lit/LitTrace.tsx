// ============================================================
// Contour's instrument in the room: a recorder's pen on a glass sheet
// (docs/plans/ear-lab-native-look.md).
//
// The pen draws the first tone as a level line while it sounds, then
// waits at the edge of a dashed box: the second tone is the question, so
// nothing is drawn for it, and a ring marks it as it sounds. At the
// reveal the pen draws the second tone where it went, up, down or level,
// at the gap's own scale, and writes the way and the gap ("Up · 100¢").
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { StylusTraceProps } from '@/features/ear-lab/StylusTrace'
import { CONTOUR_TIMING } from '@/lib/ear/timing'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import { easeInOut, easeOut, hundredth, lerp, lineD, progress, tenth, } from './draw'
import { Glow, LitDefs, litIds, paint, Ring, TEAL_PALE } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over a row of three pads. */
const HEIGHT = 421
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const TOP = 16
const BOTTOM = HEIGHT - 28
const MID = Math.round((TOP + BOTTOM) / 2)
const FIRST_X = 56
const FIRST_END = 176
const BOX_X = 206
const BOX_W = 128
/** Px a cent up or down the sheet. */
const PX_PER_CENT = 0.42
const WAY = { up: 'Up', down: 'Down', same: 'The same' } as const

export function LitTrace(props: StylusTraceProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const arrivals = useArrivals(() => props.sounding, clock)
  const revealed = (): number =>
    props.reveal === null ? 0 : easeOut(progress(clock.t(), 150, 700))
  const listening = (): boolean =>
    props.reveal === null &&
    !props.armed &&
    (props.sounding > 0 || clock.beat() === 'listen')
  const sinceFirst = (): number | null =>
    listening() ? arrivalAge(arrivals(), 0, clock) : null
  const sinceSecond = (): number | null =>
    listening() ? arrivalAge(arrivals(), 1, clock) : null

  /** How much of the first tone's line is drawn. */
  const drawn = (): number => {
    if (!listening()) return 1
    if (sinceSecond() !== null) return 1
    const since = sinceFirst()
    return since === null ? 0 : progress(since, 0, CONTOUR_TIMING.toneMs)
  }
  /** Where the second tone's line ends, at the reveal. */
  const secondY = (): number => {
    const reveal = props.reveal
    if (reveal === null || reveal.direction === 'same') return MID
    const way = reveal.direction === 'up' ? -1 : 1
    return MID + way * (reveal.cents ?? 100) * PX_PER_CENT
  }
  const pen = (): { x: number; y: number } => {
    if (props.reveal !== null)
      return { x: BOX_X + BOX_W * revealed(), y: secondY() }
    if (!listening()) return { x: BOX_X, y: MID }
    const second = sinceSecond()
    if (second !== null)
      return {
        x: lerp(FIRST_END, BOX_X, easeInOut(progress(second, 0, 150))),
        y: MID,
      }
    return { x: FIRST_X + (FIRST_END - FIRST_X) * drawn(), y: MID }
  }
  const boxLight = (): number => {
    if (props.reveal !== null) return 1 - revealed()
    if (props.armed) return 0.9
    return sinceSecond() !== null ? 0.6 : 0.3
  }
  /** The pen's glow breathes while it waits for the answer. */
  const penGlow = (): number =>
    props.armed && !clock.reduced
      ? 0.45 + 0.4 * Math.sin(clock.ambient() * 0.008)
      : 0.7
  /** The second tone's ring, again and again while it sounds. */
  const ringT = (): number => {
    const second = sinceSecond()
    if (second === null || props.sounding !== 2 || clock.reduced) return -1
    return second % 350
  }
  const label = (): string => {
    const reveal = props.reveal
    if (reveal !== null)
      return reveal.direction === 'same'
        ? 'A pen trace: the second tone was the same'
        : `A pen trace: the second tone went ${reveal.direction}${reveal.cents === undefined ? '' : `, ${reveal.cents} cents`}`
    if (props.sounding === 1) return 'A pen trace, the first tone drawing'
    if (props.sounding === 2) return 'A pen trace, the second tone sounding'
    return props.armed
      ? 'A pen trace waiting at the second tone'
      : 'A pen trace at rest'
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="pen-trace"
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
      <For
        each={Array.from(
          { length: Math.ceil((BOTTOM - TOP - 24) / 24) },
          (_, i) => TOP + 24 * (i + 1),
        )}
      >
        {(y) => (
          <line x1="28" x2="362" y1={y} y2={y} stroke="rgb(255 255 255 / 5%)" />
        )}
      </For>
      <For each={Array.from({ length: 9 }, (_, i) => 52 + 36 * i)}>
        {(x) => (
          <line
            x1={x}
            x2={x}
            y1={TOP + 10}
            y2={BOTTOM - 10}
            stroke="rgb(255 255 255 / 4%)"
          />
        )}
      </For>
      <text x={FIRST_X} y={MID - 18} class={styles.small}>
        first tone
      </text>
      <rect
        x={BOX_X}
        y={MID - 76}
        width={BOX_W}
        height="152"
        rx="14"
        fill="none"
        stroke="rgb(255 255 255 / 22%)"
        stroke-dasharray="4 6"
        opacity={hundredth(boxLight())}
        data-part="second-box"
      />
      <text
        x={BOX_X + BOX_W / 2}
        y={MID + 96}
        class={styles.small}
        text-anchor="middle"
        opacity={hundredth(props.reveal === null ? 1 : 1 - revealed())}
      >
        the second tone: your call
      </text>
      <Glow
        d={
          drawn() > 0
            ? lineD(
                FIRST_X,
                MID,
                FIRST_X + (FIRST_END - FIRST_X) * drawn(),
                MID,
              )
            : ''
        }
        width={3}
        stroke={paint(ids.across)}
      />
      <Show when={props.reveal}>
        {(reveal) => (
          <>
            <path
              d={`M${FIRST_END} ${MID}C192 ${MID} 190 ${tenth(secondY())} ${BOX_X} ${tenth(secondY())}`}
              fill="none"
              stroke="rgb(143 245 227 / 60%)"
              stroke-width="1.4"
              stroke-dasharray="3 4"
              opacity={hundredth(revealed())}
            />
            <Glow
              d={lineD(BOX_X, secondY(), BOX_X + BOX_W * revealed(), secondY())}
              width={3}
              stroke={TEAL_PALE}
            />
            <text
              x={BOX_X + BOX_W}
              y={tenth(secondY() - 16)}
              class={`${styles.name} ${styles.teal} ${styles.edged}`}
              text-anchor="end"
              opacity={hundredth(revealed())}
              data-part="way"
            >
              {WAY[reveal().direction]}
              {reveal().cents === undefined || reveal().direction === 'same'
                ? ''
                : ` · ${reveal().cents}¢`}
            </text>
          </>
        )}
      </Show>
      <circle
        cx={tenth(pen().x)}
        cy={tenth(pen().y)}
        r="16"
        fill={paint(ids.glow)}
        opacity={hundredth(penGlow())}
      />
      <circle
        cx={tenth(pen().x)}
        cy={tenth(pen().y)}
        r="5.5"
        fill="#ffffff"
        data-part="pen"
      />
      <Ring
        x={BOX_X}
        y={MID}
        t={ringT()}
        ms={350}
        from={6}
        to={26}
        width={1.8}
      />
    </svg>
  )
}
