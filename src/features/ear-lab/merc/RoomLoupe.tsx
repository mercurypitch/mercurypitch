// ============================================================
// Hairline's lens, upright, as the room draws it (ROOM_SKIN): lit glass
// in the station's light (docs/plans/ear-lab-native-look.md).
//
// The cents scale stands on its end, higher on screen for higher in
// pitch, with the two tones as two level hairlines across it, and the
// lens beside it magnifying the same two. While the tones sound and the
// answer is due, the lines stand evenly about the middle, alike and
// unnamed: the gap shows, which way it went does not. Under the lens the
// two tones are two pulses of light at one height, each lit as its tone
// sounds, so the eye follows the sound and never the answer. At the
// reveal the higher line turns teal and is named, its pulse lifts, and
// the lens says how far it magnifies.
//
// The lens magnifies by a whole number, the most up to x12 that keeps the
// two lines in its middle band with its words above and below. Past about
// 104 cents even x1 does not; there the lines stand where they are and the
// words move in between them.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, createUniqueId, For, on, Show, } from 'solid-js'
import type { VernierLoupeProps } from '@/features/ear-lab/VernierLoupe'
import { useStageClock } from './lit/clock'
import { circleD, sineD, tenth } from './lit/draw'
import { Glow, LitDefs, litIds, paint, TEAL_PALE, WHITE } from './lit/kit'
import litStyles from './lit/lit.module.css'
import styles from './loupe.module.css'

const WIDTH = 390
/** The middle of the rail and of the lens, where a gap of nothing sits. */
export const LOUPE_MIDDLE = 150
const MID_Y = LOUPE_MIDDLE
/** Px per cent, on the rail and in the glass at x1. */
const PX_PER_CENT = 0.96
/** The rail's reach either way, in cents. */
const REACH = 100
const RAIL_X = 334
const TICKS = Array.from({ length: 21 }, (_, i) => -REACH + i * 10)

const GLASS_X = 166
const GLASS_R = 124
/** How far the two lines may stand apart in the glass with its words
 *  clear of them. */
const BAND = 100
const MOST = 12

/** The two tones' pulses, under the lens. */
const PULSE_Y = MID_Y + GLASS_R + 34
const PULSE_W = 122
const PULSE_H = 38
const PULSE_X = [GLASS_X - PULSE_W - 8, GLASS_X + 8] as const
const HEIGHT = PULSE_Y + PULSE_H + 14

/** How far the glass magnifies a gap: a whole number, 1 to 12. */
export function loupeMagnification(gap: number): number {
  const span = Math.max(gap, 0.01) * PX_PER_CENT
  return Math.max(1, Math.min(MOST, Math.floor(BAND / span)))
}

/** Where a chord of the glass meets its rim, `dy` from its middle. */
function rimX(dy: number): number {
  const r = GLASS_R - 2
  return GLASS_X + Math.sqrt(Math.max(0, r * r - dy * dy))
}

const railY = (cents: number): number => MID_Y - cents * PX_PER_CENT

export function RoomLoupe(props: VernierLoupeProps): JSX.Element {
  const clip = `merc-loupe-clip-${createUniqueId()}`
  const ids = litIds()
  const clock = useStageClock()

  const gap = () => Math.max(0, props.gap)
  const magnification = () => loupeMagnification(gap())
  /** Each line's distance from the middle: on the rail, whose ends hold
   *  the widest, and in the glass. */
  const onRail = () => Math.min(REACH, gap() / 2) * PX_PER_CENT
  const inGlass = () => (gap() / 2) * PX_PER_CENT * magnification()
  /** Only at x1, past about 104 cents: the words go in between. */
  const wide = () => inGlass() * 2 > BAND

  const readout = () => `${gap().toFixed(1)}¢`
  const higherName = () =>
    props.reveal === 'first' ? 'The first' : 'The second'
  const higherTone = (): 1 | 2 | null =>
    props.reveal === null ? null : props.reveal === 'first' ? 1 : 2
  const label = () =>
    `An upright scale under a loupe: two hairlines ${readout()} apart${
      props.reveal === null
        ? ''
        : `, magnified ${magnification()} times, the ${props.reveal} tone higher`
    }`

  /** The name beside the higher line, level with it; with the lines
   *  close, a little above both, so it names the upper one. Past x1's
   *  band, just under it. */
  const tagY = () =>
    wide() ? MID_Y - inGlass() + 20 : MID_Y - Math.max(inGlass(), 9)

  const shift = (dy: number): JSX.CSSProperties => ({
    transform: `translateY(${dy}px)`,
  })

  // The tones heard in this question: a pulse that has sounded stays
  // lit, softer, until the next question starts.
  const [heard, setHeard] = createSignal<readonly boolean[]>([false, false])
  createEffect(
    on(
      () => props.sounding,
      (tone) => {
        if (tone === 0) return
        setHeard((was) => was.map((on, i) => on || i === tone - 1))
      },
    ),
  )
  createEffect(
    on(clock.beat, (beat) => {
      if (beat === 'listen' && props.sounding === 0) setHeard([false, false])
    }),
  )

  const wave = (tone: 1 | 2): string => {
    const x0 = PULSE_X[tone - 1]
    const sounding = props.sounding === tone
    return sineD(
      x0 + 34,
      x0 + PULSE_W - 14,
      PULSE_Y + PULSE_H / 2,
      sounding ? 9 : 5,
      11,
      sounding ? clock.ambient() * 0.03 : 0.6,
    )
  }
  const pulseLight = (tone: 1 | 2): number =>
    props.sounding === tone ? 0.5 : heard()[tone - 1] ? 0.22 : 0

  return (
    <svg
      class={`${litStyles.instrument} ${styles.loupe}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="upright-loupe"
      data-magnification={magnification()}
    >
      <LitDefs ids={ids} height={HEIGHT} />
      <defs>
        <clipPath id={clip}>
          <circle cx={GLASS_X} cy={MID_Y} r={GLASS_R - 3} />
        </clipPath>
      </defs>

      {/* The scale on its end, ticked every 10 cents. */}
      <line
        x1={RAIL_X}
        x2={RAIL_X}
        y1={railY(REACH)}
        y2={railY(-REACH)}
        class={styles.rail}
      />
      <For each={TICKS}>
        {(cents) => (
          <line
            x1={RAIL_X - (cents % 50 === 0 ? 12 : 7)}
            x2={RAIL_X}
            y1={railY(cents)}
            y2={railY(cents)}
            class={styles.tick}
            classList={{ [styles.tickMajor]: cents % 50 === 0 }}
          />
        )}
      </For>
      <text
        x={RAIL_X + 12}
        y={railY(50)}
        class={styles.caption}
        dominant-baseline="central"
      >
        +50¢
      </text>
      <text
        x={RAIL_X + 12}
        y={railY(0)}
        class={styles.caption}
        dominant-baseline="central"
      >
        0
      </text>
      <text
        x={RAIL_X + 12}
        y={railY(-50)}
        class={styles.caption}
        dominant-baseline="central"
      >
        −50¢
      </text>

      {/* From each line on the rail to the same line in the glass. */}
      <line
        x1={RAIL_X - 18}
        y1={MID_Y - onRail()}
        x2={rimX(inGlass())}
        y2={MID_Y - inGlass()}
        class={styles.lead}
      />
      <line
        x1={RAIL_X - 18}
        y1={MID_Y + onRail()}
        x2={rimX(inGlass())}
        y2={MID_Y + inGlass()}
        class={styles.lead}
      />

      <g class={styles.mover} style={shift(-onRail())}>
        <line
          x1={RAIL_X - 18}
          x2={RAIL_X + 5}
          y1={MID_Y}
          y2={MID_Y}
          class={styles.hair}
          classList={{ [styles.higher]: props.reveal !== null }}
          data-line="upper"
        />
      </g>
      <g class={styles.mover} style={shift(onRail())}>
        <line
          x1={RAIL_X - 18}
          x2={RAIL_X + 5}
          y1={MID_Y}
          y2={MID_Y}
          class={styles.hair}
          data-line="lower"
        />
      </g>

      {/* The lens: its glow, the glass, faint lines across it, its lit rim. */}
      <circle
        cx={GLASS_X}
        cy={MID_Y}
        r={GLASS_R + 30}
        fill={paint(ids.glow)}
        opacity="0.32"
      />
      <circle cx={GLASS_X} cy={MID_Y} r={GLASS_R} fill={paint(ids.lens)} />
      <g clip-path={`url(#${clip})`}>
        <For
          each={Array.from(
            { length: Math.floor((GLASS_R * 2 - 10) / 16) },
            (_, i) => MID_Y - GLASS_R + 10 + i * 16,
          )}
        >
          {(y) => (
            <line
              x1={GLASS_X - GLASS_R}
              x2={GLASS_X + GLASS_R}
              y1={y}
              y2={y}
              class={litStyles.faint}
            />
          )}
        </For>
        <g class={styles.mover} style={shift(-inGlass())}>
          <line
            x1={GLASS_X - GLASS_R}
            x2={
              props.reveal !== null && !wide() ? GLASS_X - 8 : GLASS_X + GLASS_R
            }
            y1={MID_Y}
            y2={MID_Y}
            class={styles.halo}
            classList={{ [styles.higher]: props.reveal !== null }}
          />
          <line
            x1={GLASS_X - GLASS_R}
            x2={
              props.reveal !== null && !wide() ? GLASS_X - 8 : GLASS_X + GLASS_R
            }
            y1={MID_Y}
            y2={MID_Y}
            class={`${styles.hair} ${styles.magnified}`}
            classList={{ [styles.higher]: props.reveal !== null }}
            data-line="upper-magnified"
          />
        </g>
        <g class={styles.mover} style={shift(inGlass())}>
          <line
            x1={GLASS_X - GLASS_R}
            x2={GLASS_X + GLASS_R}
            y1={MID_Y}
            y2={MID_Y}
            class={styles.halo}
          />
          <line
            x1={GLASS_X - GLASS_R}
            x2={GLASS_X + GLASS_R}
            y1={MID_Y}
            y2={MID_Y}
            class={`${styles.hair} ${styles.magnified}`}
            data-line="lower-magnified"
          />
        </g>
      </g>
      <Glow
        d={circleD(GLASS_X, MID_Y, GLASS_R)}
        width={2.6}
        stroke={paint(ids.across)}
      />
      <circle
        cx={GLASS_X}
        cy={MID_Y}
        r={GLASS_R - 8}
        fill="none"
        class={styles.glass}
      />
      <text
        x={GLASS_X}
        y={wide() ? MID_Y + 7 : MID_Y - 64}
        class={`${styles.readout} ${litStyles.edged}`}
        text-anchor="middle"
        data-testid="loupe-readout"
      >
        {readout()}
      </text>
      <Show when={props.reveal !== null}>
        <text
          x={wide() ? GLASS_X : GLASS_X - 2}
          y={tagY()}
          class={`${styles.tag} ${litStyles.edged}`}
          text-anchor={wide() ? 'middle' : 'start'}
          dominant-baseline="central"
          data-testid="loupe-higher"
        >
          {higherName()}
        </text>
        <text
          x={GLASS_X}
          y={wide() ? MID_Y + 30 : MID_Y + 78}
          class={styles.magnification}
          text-anchor="middle"
          data-testid="loupe-magnification"
        >
          ×{magnification()}
        </text>
      </Show>

      {/* The two tones as pulses of light at one height. */}
      <For each={[1, 2] as const}>
        {(tone) => {
          const x0 = PULSE_X[tone - 1]
          const lift = () => (higherTone() === tone ? -6 : 0)
          return (
            <g
              class={styles.pulse}
              style={shift(lift())}
              data-pulse={tone}
              data-sounding={props.sounding === tone ? '' : undefined}
            >
              <rect
                x={x0}
                y={PULSE_Y}
                width={PULSE_W}
                height={PULSE_H}
                rx={PULSE_H / 2}
                fill={paint(ids.glass)}
                class={litStyles.glass}
              />
              <rect
                x={x0}
                y={PULSE_Y}
                width={PULSE_W}
                height={PULSE_H}
                rx={PULSE_H / 2}
                fill={paint(ids.across)}
                opacity={pulseLight(tone)}
                class={litStyles.fade}
              />
              <Glow
                d={wave(tone)}
                width={1.8}
                stroke={WHITE}
                opacity={props.sounding === tone ? 1 : 0.6}
              />
              <text
                x={x0 + 17}
                y={tenth(PULSE_Y + PULSE_H / 2 + 5)}
                class={litStyles.number}
              >
                {tone}
              </text>
              <Show when={higherTone() === tone}>
                <Glow
                  d={`M${x0 + PULSE_W / 2 - 7} ${PULSE_Y - 9}l7 -7l7 7`}
                  width={2}
                  stroke={TEAL_PALE}
                />
              </Show>
            </g>
          )
        }}
      </For>
    </svg>
  )
}
