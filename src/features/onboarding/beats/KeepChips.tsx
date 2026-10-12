// ============================================================
// Keep's motion chips: what an account keeps, each drawn once
// ============================================================
//
// Owner decision, 12 Oct 2026 ("Motion chip per row"): each of Keep's rows
// leads with a small chip in the twin stat card's language instead of a
// static icon. The singer's own glides, as the same gold ridge, are the
// thread through all three:
//
//   voiceprint  the ridge draws left to right, then a check settles at its end
//   devices     the ridge lights on a phone, a point of light arcs over, and
//               the laptop's screen lights with the same ridge
//   podium      three bars rise and a gold star lands on the tallest
//
// Each chip plays once on mount, staggered, about 2.4 s for all three, and
// holds. Only stroke-dashoffset, transform and opacity move. Every drawn
// element's resting style IS the settled frame and the animation only runs
// from the start state into it, so reduced motion (animation: none) shows
// the end state, and so does a browser that drops the animation.
//
// The chips are decoration: aria-hidden, no text. The row's words carry the
// meaning, and the tests pin those words.

import type { Component } from 'solid-js'
import { createMemo, createUniqueId, Match, Show, Switch } from 'solid-js'
import type { RangeResult } from '@/lib/mirror/metrics'
import type { RidgeBox, RidgeShape } from '../voice-strip'
import { idealStrip, RIDGE_BOX, ridgeShape } from '../voice-strip'
import styles from './KeepChips.module.css'

export type KeepChipKind = 'voiceprint' | 'devices' | 'podium'
export type KeepChipTone = 'teal' | 'blue' | 'violet'

type Range = Pick<RangeResult, 'lowMidi' | 'highMidi'>

/**
 * What a voiceprint with no range draws: a low rise and fall, a fifth in a
 * box tall for an octave, so it reads as a gentle glide and claims nothing.
 */
export const PLAIN_GLIDE: Range = { lowMidi: 0, highMidi: 7 }

/** Where a ridge sits in a chip (viewBox units), and the box it is laid out in. */
export interface RidgeFrame {
  x: number
  y: number
  /** viewBox units per ridge unit. */
  scale: number
  /** The box `ridgeShape` lays the strip out in: the stat card's height,
   *  and this frame's proportions, so the line keeps the card's margins. */
  box: RidgeBox
}

function ridgeFrame(
  x: number,
  y: number,
  width: number,
  height: number,
): RidgeFrame {
  const scale = height / RIDGE_BOX.height
  return {
    x,
    y,
    scale,
    box: { width: Math.round(width / scale), height: RIDGE_BOX.height },
  }
}

/**
 * Every chip is drawn in this box and scaled to fit, centred: 34x30 on a
 * phone, 48x34 and 56x40 wider. It is narrower than the wide chips so the
 * phone's chip can be as narrow as the icon and gap it replaced, which keeps
 * the rows' words exactly the room they had.
 */
const VIEW_W = 40
const VIEW_H = 34

/** The voiceprint chip's ridge, with room at its right for the check. */
export const VOICE_RIDGE = ridgeFrame(4, 7, 26, 20)
/** The ridge on the phone's screen: lower than it is wide, so it reads as
 *  the same hill rather than a peak. */
export const PHONE_RIDGE = ridgeFrame(5.3, 17.2, 6.4, 5)
/** The same ridge on the laptop's screen. */
export const LAPTOP_RIDGE = ridgeFrame(19.6, 15, 12.3, 6.6)

/**
 * The line a chip draws: the singer's own glides; the range's own rise and
 * fall when the glides did not come with it; a plain gentle glide when there
 * is no range at all.
 */
export function chipRidge(
  strip: readonly number[] | null,
  range: Range | null,
  box: RidgeBox,
): RidgeShape {
  if (range === null)
    return ridgeShape(idealStrip(PLAIN_GLIDE), PLAIN_GLIDE, box)
  const points = strip !== null && strip.length >= 2 ? strip : idealStrip(range)
  return ridgeShape(points, range, box)
}

/** Five points, centred on the origin, the first at the top. */
function starPath(outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    return `${(r * Math.cos(angle)).toFixed(2)} ${(r * Math.sin(angle)).toFixed(2)}`
  })
  return `M${points.join(' L')} Z`
}

const STAR = starPath(4.7, 2.05)

/** The ridge's gold where the line is too short for the card's gradient. */
const GOLD = '#ffd98f'

interface RidgeProps {
  frame: RidgeFrame
  shape: RidgeShape
  /** Line and glow widths, in viewBox units. */
  line: number
  glow: number
  /** Which ridge this is: its timing lives in the stylesheet. */
  class: string
  /** A paint for the line; the plain gold when absent. */
  stroke?: string
  /** The gold haze under the line, by its gradient's url. */
  haze?: string
}

/** One gold ridge, laid out in its own box and scaled into the chip. */
const Ridge: Component<RidgeProps> = (props) => (
  <g
    class={props.class}
    transform={`translate(${props.frame.x} ${props.frame.y}) scale(${props.frame.scale})`}
  >
    <Show when={props.haze}>
      {(haze) => (
        <path class={styles.haze} d={props.shape.area} fill={haze()} />
      )}
    </Show>
    <path
      class={styles.ridgeGlow}
      d={props.shape.line}
      pathLength="1"
      stroke-width={props.glow / props.frame.scale}
    />
    <path
      class={styles.ridgeLine}
      d={props.shape.line}
      pathLength="1"
      stroke={props.stroke ?? GOLD}
      stroke-width={props.line / props.frame.scale}
      data-ridge-line
    />
  </g>
)

interface ArtProps {
  strip: readonly number[] | null
  range: Range | null
}

/** The voiceprint, saved: the singer's ridge draws, then a check lands. */
const VoiceprintArt: Component<ArtProps> = (props) => {
  const id = createUniqueId()
  const shape = createMemo(() =>
    chipRidge(props.strip, props.range, VOICE_RIDGE.box),
  )
  const end = createMemo(() => {
    const points = shape().points
    const [x, y] = points[points.length - 1]
    return {
      x: VOICE_RIDGE.x + x * VOICE_RIDGE.scale,
      y: VOICE_RIDGE.y + y * VOICE_RIDGE.scale,
    }
  })

  return (
    <>
      <defs>
        <linearGradient
          id={`${id}-gold`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={VOICE_RIDGE.box.width}
          y2="0"
        >
          <stop offset="0" stop-color="#f0b45a" />
          <stop offset="0.5" stop-color="#ffe9a8" />
          <stop offset="1" stop-color="#f0b45a" />
        </linearGradient>
        <linearGradient id={`${id}-haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffd98f" stop-opacity="0.32" />
          <stop offset="1" stop-color="#ffd98f" stop-opacity="0" />
        </linearGradient>
      </defs>
      <Ridge
        class={styles.voiceRidge}
        frame={VOICE_RIDGE}
        shape={shape()}
        line={1.7}
        glow={4.6}
        stroke={`url(#${id}-gold)`}
        haze={`url(#${id}-haze)`}
      />
      <g transform={`translate(${end().x.toFixed(2)} ${end().y.toFixed(2)})`}>
        <g class={styles.check} data-check>
          <circle class={styles.checkDisc} r="5" />
          <path
            class={styles.checkMark}
            d="M-2.3 0.1 L-0.7 1.8 L2.4 -1.6"
            pathLength="1"
          />
        </g>
      </g>
    </>
  )
}

/** On every device: the ridge on a phone, a light arcs over, the laptop lights. */
const DevicesArt: Component<ArtProps> = (props) => {
  const phone = createMemo(() =>
    chipRidge(props.strip, props.range, PHONE_RIDGE.box),
  )
  const laptop = createMemo(() =>
    chipRidge(props.strip, props.range, LAPTOP_RIDGE.box),
  )
  const arc = 'M8.5 9.2 Q16.5 -0.4 25.75 10.7'

  return (
    <>
      <rect
        class={styles.device}
        x="3.5"
        y="10.5"
        width="10"
        height="18.5"
        rx="2.2"
      />
      <rect
        class={styles.phoneLight}
        x="4.9"
        y="12.3"
        width="7.2"
        height="14.9"
        rx="1.1"
      />
      <Ridge
        class={styles.phoneRidge}
        frame={PHONE_RIDGE}
        shape={phone()}
        line={1.1}
        glow={2.8}
      />

      <rect
        class={styles.device}
        x="17"
        y="12"
        width="17.5"
        height="12.5"
        rx="1.7"
      />
      <rect
        class={styles.laptopLight}
        x="18.4"
        y="13.4"
        width="14.7"
        height="9.7"
        rx="0.8"
      />
      <path class={styles.deviceBase} d="M15 27.4 H36.5" />
      <Ridge
        class={styles.laptopRidge}
        frame={LAPTOP_RIDGE}
        shape={laptop()}
        line={1.2}
        glow={3}
      />

      <path class={styles.trace} d={arc} pathLength="1" />
      <path
        class={`${styles.spark} ${styles.sparkGlow}`}
        d={arc}
        pathLength="1"
      />
      <path
        class={`${styles.spark} ${styles.sparkTail2}`}
        d={arc}
        pathLength="1"
      />
      <path
        class={`${styles.spark} ${styles.sparkTail1}`}
        d={arc}
        pathLength="1"
      />
      <path
        class={`${styles.spark} ${styles.sparkCore}`}
        d={arc}
        pathLength="1"
      />
    </>
  )
}

/** A place on the leaderboard: three bars rise, a star lands on the tallest. */
const PodiumArt: Component = () => {
  const id = createUniqueId()
  return (
    <>
      <defs>
        <linearGradient id={`${id}-star`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffe9a8" />
          <stop offset="1" stop-color="#f0b45a" />
        </linearGradient>
      </defs>
      <rect
        class={`${styles.bar} ${styles.barSecond}`}
        x="6.25"
        y="19"
        width="8.5"
        height="10"
        rx="1.4"
      />
      <rect
        class={`${styles.bar} ${styles.barFirst}`}
        x="15.75"
        y="14"
        width="8.5"
        height="15"
        rx="1.4"
      />
      <rect
        class={`${styles.bar} ${styles.barThird}`}
        x="25.25"
        y="22"
        width="8.5"
        height="7"
        rx="1.4"
      />
      <g transform="translate(20 9.3)">
        <circle class={styles.glint} r="6.2" />
        <g class={styles.star}>
          <circle class={styles.starHalo} r="5.6" />
          <path d={STAR} fill={`url(#${id}-star)`} />
        </g>
      </g>
    </>
  )
}

export interface KeepChipProps {
  kind: KeepChipKind
  /** The row's tone: the chip's outline and tint. The gold is always gold. */
  tone: KeepChipTone
  /** The singer's glides as pitches (voice-strip.ts), or null. */
  strip: readonly number[] | null
  /** The voiceprint's range, or null when it has none. */
  range: Range | null
}

export const KeepChip: Component<KeepChipProps> = (props) => (
  <span
    class={styles.chip}
    data-chip={props.kind}
    data-tone={props.tone}
    aria-hidden="true"
  >
    <svg class={styles.art} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      <Switch>
        <Match when={props.kind === 'voiceprint'}>
          <VoiceprintArt strip={props.strip} range={props.range} />
        </Match>
        <Match when={props.kind === 'devices'}>
          <DevicesArt strip={props.strip} range={props.range} />
        </Match>
        <Match when={props.kind === 'podium'}>
          <PodiumArt />
        </Match>
      </Switch>
    </svg>
  </span>
)
