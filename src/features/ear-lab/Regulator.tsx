// ============================================================
// Regulator — the Ear Lab's signature object. A tall-case regulator
// clock whose pendulum bob is the Mercury Column: the sealed fill
// is the last *calibrated* Mercury Index, the fainter meniscus
// above it is the live practice estimate, and every past
// calibration stays etched into the glass with its date. A dashed
// cap warns that faculties are still unmeasured, so a high early
// number cannot read as a finished verdict.
//
// The swing is the only motion on the bench that is not a direct
// response to the user; reduced motion stops it.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { INDEX_MAX } from '@/lib/ear/mercury-index'
import { dateLabel } from './instruments'
import styles from './Regulator.module.css'

export interface ColumnMark {
  at: number
  index: number
}

interface RegulatorProps {
  /** Last calibrated index, or null before the first calibration. */
  calibrated: number | null
  /** Live practice estimate (0 hides the meniscus). */
  estimate: number
  /** Past calibrations, newest first. */
  marks: ColumnMark[]
  /** Faculties with no reading yet — drawn as the dashed cap. */
  missingCount: number
}

const CX = 120
const DIAL_CY = 92
const DIAL_R = 50
const JAR_X = 88
const JAR_W = 64
const JAR_TOP = 356
const JAR_H = 118
/** The mercury sits inside the glass wall. */
const FILL_X = JAR_X + 4
const FILL_W = JAR_W - 8
const FILL_TOP = JAR_TOP + 6
const FILL_BOTTOM = JAR_TOP + JAR_H - 6
const MAX_MARKS = 6
const TICKS = Array.from({ length: 21 }, (_, i) => i)

function clampIndex(index: number): number {
  return Math.max(0, Math.min(INDEX_MAX, index))
}

/** The glass height a 0–1000 index fills to. */
function yFor(index: number): number {
  const t = clampIndex(index) / INDEX_MAX
  return FILL_BOTTOM - t * (FILL_BOTTOM - FILL_TOP)
}

function tickEnds(i: number, inner: number, outer: number) {
  const angle = ((-120 + (240 * i) / 20) * Math.PI) / 180
  return {
    x1: CX + Math.sin(angle) * inner,
    y1: DIAL_CY - Math.cos(angle) * inner,
    x2: CX + Math.sin(angle) * outer,
    y2: DIAL_CY - Math.cos(angle) * outer,
  }
}

export function Regulator(props: RegulatorProps): JSX.Element {
  const fillY = () => yFor(props.calibrated ?? 0)
  const shownMarks = () => props.marks.slice(0, MAX_MARKS)
  const showMeniscus = () =>
    props.estimate > 0 && props.estimate !== (props.calibrated ?? -1)

  const summary = () => {
    const sealed =
      props.calibrated === null
        ? 'The Mercury Column is not yet marked.'
        : `The Mercury Column is sealed at ${props.calibrated} of ${INDEX_MAX}.`
    const estimate = showMeniscus()
      ? ` Practice estimate ${props.estimate}.`
      : ''
    const marks =
      props.marks.length > 0
        ? ` ${props.marks.length} calibration mark${
            props.marks.length === 1 ? '' : 's'
          }, latest ${dateLabel(props.marks[0].at)}.`
        : ''
    const missing =
      props.missingCount > 0
        ? ` ${props.missingCount} facult${
            props.missingCount === 1 ? 'y is' : 'ies are'
          } still unmeasured.`
        : ''
    return `${sealed}${estimate}${marks}${missing}`
  }

  return (
    <figure class={styles.regulator}>
      <svg
        viewBox="0 0 240 520"
        role="img"
        aria-label={summary()}
        class={styles.svg}
      >
        <defs>
          <linearGradient
            id="ear-regulator-mercury"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0" stop-color="#8f9daf" />
            <stop offset="0.35" stop-color="#e3e9f0" />
            <stop offset="0.7" stop-color="#c5ced8" />
            <stop offset="1" stop-color="#7f8c9c" />
          </linearGradient>
          <linearGradient id="ear-regulator-glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0.12" />
            <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.02" />
            <stop offset="1" stop-color="#ffffff" stop-opacity="0.1" />
          </linearGradient>
        </defs>

        {/* the case */}
        <rect
          x="8"
          y="8"
          width="224"
          height="504"
          rx="10"
          class={styles.case}
        />
        <rect
          x="18"
          y="18"
          width="204"
          height="484"
          rx="6"
          class={styles.caseInner}
        />

        {/* the small index dial in the hood */}
        <circle cx={CX} cy={DIAL_CY} r={DIAL_R} class={styles.dial} />
        <g class={styles.ticks}>
          <For each={TICKS}>
            {(i) => {
              const major = i % 5 === 0
              const ends = tickEnds(
                i,
                major ? DIAL_R - 12 : DIAL_R - 8,
                DIAL_R - 4,
              )
              return (
                <line
                  x1={ends.x1}
                  y1={ends.y1}
                  x2={ends.x2}
                  y2={ends.y2}
                  classList={{ [styles.tickMajor]: major }}
                />
              )
            }}
          </For>
        </g>
        <text
          x={CX}
          y={DIAL_CY - 16}
          class={styles.dialLabel}
          text-anchor="middle"
        >
          INDEX
        </text>
        <text
          x={CX}
          y={DIAL_CY + 14}
          class={styles.dialValue}
          text-anchor="middle"
        >
          {props.calibrated ?? '—'}
        </text>

        {/* the pendulum: rod, suspension, and the mercury jar as the bob */}
        <g class={styles.pendulum}>
          <rect
            x={CX - 6}
            y={DIAL_CY + DIAL_R - 2}
            width="12"
            height="10"
            rx="2"
            class={styles.brass}
          />
          <line
            x1={CX}
            y1={DIAL_CY + DIAL_R + 8}
            x2={CX}
            y2={JAR_TOP + 2}
            class={styles.rod}
          />

          <rect
            x={JAR_X}
            y={JAR_TOP}
            width={JAR_W}
            height={JAR_H}
            rx="7"
            class={styles.jar}
          />
          <Show when={props.calibrated !== null}>
            <rect
              x={FILL_X}
              y={fillY()}
              width={FILL_W}
              height={Math.max(0, FILL_BOTTOM - fillY())}
              rx="3"
              fill="url(#ear-regulator-mercury)"
            />
          </Show>
          <rect
            x={JAR_X}
            y={JAR_TOP}
            width={JAR_W}
            height={JAR_H}
            rx="7"
            fill="url(#ear-regulator-glass)"
          />
          <rect
            x={JAR_X - 4}
            y={JAR_TOP - 8}
            width={JAR_W + 8}
            height="12"
            rx="3"
            class={styles.brass}
          />

          <Show when={showMeniscus()}>
            <line
              x1={FILL_X}
              y1={yFor(props.estimate)}
              x2={FILL_X + FILL_W}
              y2={yFor(props.estimate)}
              class={styles.meniscus}
            />
          </Show>

          <Show when={props.missingCount > 0}>
            <line
              x1={JAR_X - 6}
              y1={FILL_TOP}
              x2={JAR_X + JAR_W + 6}
              y2={FILL_TOP}
              class={styles.cap}
            />
          </Show>

          {/* etched marks: a scratch on the glass at the true height, the date beside it */}
          <For each={shownMarks()}>
            {(mark, i) => (
              <g class={styles.etch}>
                <line
                  x1={JAR_X + JAR_W - 2}
                  y1={yFor(mark.index)}
                  x2={JAR_X + JAR_W + 8}
                  y2={yFor(mark.index)}
                />
                <text x={JAR_X + JAR_W + 12} y={JAR_TOP + 14 + i() * 15}>
                  {dateLabel(mark.at)} · {mark.index}
                </text>
              </g>
            )}
          </For>
        </g>

        <text x={CX} y="496" class={styles.caption} text-anchor="middle">
          <Show when={props.marks.length > 0} fallback="NOT YET MARKED">
            SEALED {dateLabel(props.marks[0].at).toUpperCase()}
          </Show>
        </text>
      </svg>
      <figcaption class={styles.legend}>
        <Show
          when={props.calibrated !== null}
          fallback={
            <span>
              Nothing is marked yet. A sealed calibration fills the glass.
            </span>
          }
        >
          <Show when={showMeniscus()}>
            <span>
              Practice estimate <b>{props.estimate}</b> — the fainter line, not
              a mark.
            </span>
          </Show>
        </Show>
        <Show when={props.missingCount > 0}>
          <span class={styles.legendMissing}>
            {props.missingCount} facult
            {props.missingCount === 1 ? 'y' : 'ies'} unmeasured — the cap stays
            dashed.
          </span>
        </Show>
      </figcaption>
    </figure>
  )
}
