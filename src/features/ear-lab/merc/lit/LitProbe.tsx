// ============================================================
// Home's and Gravity's instrument in the room: the cadence's four lamps,
// a glass orb the note rings out of, and the scale beside it, seven
// degrees for Home and twelve for Gravity (docs/plans/ear-lab-native-
// look.md).
//
// The lamps light as the cadence lands, then the orb rings with the note
// and keeps breathing while the answer is open; nothing on the scale is
// lit, because where the note sits is the question. At the reveal the
// orb takes the degree's name, its place on the scale lights teal with a
// thread from the orb to it, and after a wrong pick the pick is marked
// red and the note falls home to Do.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { TuningForkProps } from '@/features/ear-lab/TuningFork'
import { HOME_DEGREES } from '@/lib/ear/item-bank'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import { circleD, easeInOut, easeOut, hundredth, lerp, lineD, progress, tenth, } from './draw'
import { Glow, LitDefs, litIds, Orb, paint, RED, Ring, TEAL_PALE } from './kit'
import styles from './lit.module.css'

const CADENCE = ['I', 'IV', 'V', 'I']
const LAMP_W = 50
const LAMP_GAP = 10
/** The degrees of the major scale, by semitone: the long ticks. */
const DIATONIC = new Set([0, 2, 4, 5, 7, 9, 11])
const ORB_X = 168
const R = 62
const COLUMN_X = 340
const COLUMN_TOP = 74
/** How long a cadence lamp stays full after its chord lands. */
const LAMP_MS = 460

export function LitProbe(props: TuningForkProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const chords = useArrivals(() => props.cadenceStep, clock)
  const rings = useArrivals(() => (props.ringing ? 1 : 0), clock)

  const rows = createMemo(() =>
    [...(props.scale ?? HOME_DEGREES)].sort((a, b) => a.semitone - b.semitone),
  )
  /** The stage over Gravity's twelve keys is shorter than over Home's
   *  seven. */
  const height = (): number => (rows().length > 7 ? 383 : 421)
  const orbY = (): number => Math.round(height() * 0.52)
  const columnBottom = (): number => height() - 50
  const rowY = (i: number): number =>
    columnBottom() -
    (i * (columnBottom() - COLUMN_TOP)) / Math.max(1, rows().length - 1)
  const rowOf = (semitone: number | null | undefined): number =>
    semitone === null || semitone === undefined
      ? -1
      : rows().findIndex((row) => row.semitone === semitone)

  const answerRow = (): number => {
    const reveal = props.reveal
    if (reveal === null) return -1
    if (reveal.semitone !== undefined) return rowOf(reveal.semitone)
    const degree = HOME_DEGREES.find(
      (d) => String(d.degree) === String(reveal.degree),
    )
    return rowOf(degree?.semitone)
  }
  const pickRow = (): number =>
    props.reveal?.correct === false ? rowOf(props.reveal.picked) : -1
  const revealed = (): number =>
    props.reveal === null ? 0 : easeOut(progress(clock.t(), 100, 600))
  /** The note's fall home after a miss: 0 to 1. */
  const falling = (): number =>
    pickRow() < 0 ? 0 : easeInOut(progress(clock.t(), 600, 1400))

  const listening = (): boolean =>
    props.reveal === null && clock.beat() === 'listen'
  const lampLight = (j: number): number => {
    if (!listening()) return 0.35
    const since = arrivalAge(chords(), j, clock)
    if (since === null) return 0
    return since < LAMP_MS ? 1 : 0.35
  }
  /** The orb's light: 1 while the note rings, breathing while the answer
   *  is open, low before the note. */
  const glow = (): number => {
    if (props.reveal !== null) return 0.75
    if (props.ringing) return 1
    if (listening()) return rings().length > 0 ? 0.6 : 0.15
    return clock.reduced ? 0.5 : 0.5 + 0.12 * Math.sin(clock.ambient() * 0.004)
  }
  /** Ring `i`'s place in its cycle, or -1 for none. */
  const ringT = (i: number): number => {
    if (clock.reduced || props.reveal !== null) return -1
    if (props.ringing) {
      const since = arrivalAge(rings(), 0, clock)
      return since === null ? -1 : (since + i * 260) % 780
    }
    if (listening()) return -1
    return ((clock.ambient() + i * 900) % 2700) / (2700 / 780)
  }

  const label = (): string => {
    const reveal = props.reveal
    if (reveal !== null)
      return `A glass orb over the scale: ${reveal.solfege} (${reveal.degree})`
    if (props.ringing) return 'A glass orb, the note ringing'
    return props.cadenceStep > 0 && props.cadenceStep < 4
      ? `A glass orb, the cadence's chord ${props.cadenceStep} of 4`
      : 'A glass orb over the scale'
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${height()}`}
      role="img"
      aria-label={label()}
      data-instrument="glass-orb"
    >
      <LitDefs ids={ids} height={height() + 100} />
      <For each={CADENCE}>
        {(chord, j) => {
          const x = (): number =>
            ORB_X -
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

      <circle
        cx={ORB_X}
        cy={orbY()}
        r={R + 40}
        fill={paint(ids.glow)}
        opacity="0.35"
      />
      <circle cx={ORB_X} cy={orbY()} r={R} fill={paint(ids.lens)} />
      <Glow
        d={circleD(ORB_X, orbY(), R)}
        width={2.4}
        stroke={props.reveal === null ? paint(ids.across) : TEAL_PALE}
      />
      <For each={[0, 1, 2]}>
        {(i) => (
          <Ring
            x={ORB_X}
            y={orbY()}
            t={ringT(i)}
            ms={780}
            from={props.ringing ? R * 0.4 : R * 0.6}
            to={props.ringing ? R + 44 : R + 30}
            width={1.6}
          />
        )}
      </For>
      <Orb
        ids={ids}
        x={ORB_X}
        y={orbY()}
        r={16}
        lit={props.reveal === null ? hundredth(0.35 + glow() * 0.65) : 0}
        glow={props.reveal === null ? hundredth(glow() * 0.8) : 0}
      />
      <Show when={props.reveal}>
        {(reveal) => (
          <g opacity={hundredth(revealed())}>
            <text
              x={ORB_X}
              y={orbY() + 4}
              class={`${styles.title} ${styles.edged}`}
              text-anchor="middle"
              data-part="solfege"
            >
              {reveal().solfege}
            </text>
            <text
              x={ORB_X}
              y={orbY() + 28}
              class={styles.number}
              text-anchor="middle"
              data-part="degree"
            >
              {reveal().degree}
            </text>
          </g>
        )}
      </Show>

      <Glow
        d={lineD(
          COLUMN_X + 14,
          COLUMN_TOP - 10,
          COLUMN_X + 14,
          columnBottom() + 10,
        )}
        width={1.2}
        stroke="rgb(200 205 235 / 35%)"
      />
      <For each={rows()}>
        {(row, i) => {
          const diatonic = DIATONIC.has(row.semitone)
          return (
            <>
              <line
                x1={diatonic ? COLUMN_X - 6 : COLUMN_X + 2}
                x2={COLUMN_X + 14}
                y1={tenth(rowY(i()))}
                y2={tenth(rowY(i()))}
                stroke="rgb(200 205 235 / 50%)"
                stroke-width={diatonic ? 1.6 : 1.1}
              />
              <text
                x={COLUMN_X - 12}
                y={tenth(rowY(i()) + 4)}
                class={diatonic ? styles.caption : styles.small}
                text-anchor="end"
              >
                {row.solfege}
              </text>
            </>
          )
        }}
      </For>
      <text
        x={COLUMN_X + 14}
        y={columnBottom() + 28}
        class={styles.small}
        text-anchor="middle"
      >
        home
      </text>

      <Show when={answerRow() >= 0}>
        <g data-part="answer" opacity={hundredth(revealed())}>
          <path
            d={`M${ORB_X + R + 6} ${orbY()}C${ORB_X + R + 50} ${orbY()} ${COLUMN_X - 60} ${tenth(rowY(answerRow()))} ${COLUMN_X - 14} ${tenth(rowY(answerRow()))}`}
            fill="none"
            stroke="rgb(143 245 227 / 55%)"
            stroke-width="1.3"
            stroke-dasharray="3 4"
          />
          <Glow
            d={lineD(
              COLUMN_X - 8,
              rowY(answerRow()),
              COLUMN_X + 22,
              rowY(answerRow()),
            )}
            width={3}
            stroke={TEAL_PALE}
          />
        </g>
      </Show>
      <Show when={pickRow() >= 0}>
        <g data-part="pick" opacity={hundredth(revealed())}>
          <Glow
            d={lineD(
              COLUMN_X - 8,
              rowY(pickRow()),
              COLUMN_X + 22,
              rowY(pickRow()),
            )}
            width={3}
            stroke={RED}
          />
        </g>
        <Show when={falling() > 0}>
          <g data-part="fall">
            <Glow
              d={lineD(
                COLUMN_X + 14,
                rowY(answerRow()),
                COLUMN_X + 14,
                lerp(rowY(answerRow()), rowY(0), falling()),
              )}
              width={2.2}
              stroke={TEAL_PALE}
              opacity={0.8}
            />
            <Orb
              ids={ids}
              x={COLUMN_X + 14}
              y={lerp(rowY(answerRow()), rowY(0), falling())}
              r={7}
              glow={falling() < 1 ? 0.9 : 0}
            />
          </g>
        </Show>
      </Show>
    </svg>
  )
}
