// ============================================================
// MercuryColumn — the Ear Lab's hero: a calibrated quicksilver
// thermometer. Solid fill = the last *calibrated* Mercury Index
// (the only proven number); the dashed meniscus floats at the
// live practice estimate; every past calibration stays etched
// into the glass with its date. A dashed cap warns that faculties
// are still unmeasured, so a high early number cannot read as a
// finished verdict.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { INDEX_MAX } from '@/lib/ear/mercury-index'
import styles from './MercuryColumn.module.css'

export interface ColumnMark {
  at: number
  index: number
}

interface MercuryColumnProps {
  /** Last calibrated index, or null before the first calibration. */
  calibrated: number | null
  /** Live practice estimate (0 hides the meniscus). */
  estimate: number
  /** Past calibrations, newest first. */
  marks: ColumnMark[]
  /** Faculties with no reading yet — drawn as the dashed cap. */
  missingCount: number
}

const TUBE_X = 60
const TUBE_W = 30
const TUBE_TOP = 30
/** The 0 mark. */
const TUBE_BOTTOM = 292
const BULB_CY = 306
/** Wide enough to swallow the tube's rounded bottom cap whole — the
 *  bulb is painted over it, so the tube appears to run INTO the
 *  bulb instead of being stroked as an oval across its face. */
const BULB_R = 25
/** The tube's glass ends at the bulb's centre, hidden inside it. */
const TUBE_GLASS_TOP = TUBE_TOP - 8
const TUBE_GLASS_HEIGHT = BULB_CY - TUBE_GLASS_TOP

function yFor(index: number): number {
  const t = Math.max(0, Math.min(INDEX_MAX, index)) / INDEX_MAX
  return TUBE_BOTTOM - t * (TUBE_BOTTOM - TUBE_TOP)
}

function markLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function MercuryColumn(props: MercuryColumnProps): JSX.Element {
  const fillY = () => yFor(props.calibrated ?? 0)
  const shownMarks = () => props.marks.slice(0, 6)

  return (
    <svg
      class={styles.column}
      viewBox="0 0 150 340"
      role="img"
      aria-label={
        props.calibrated === null
          ? 'Mercury Index: not yet calibrated'
          : `Mercury Index: ${props.calibrated} of ${INDEX_MAX}, calibrated`
      }
    >
      <defs>
        <linearGradient id="ear-mercury" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#8fa0b4" />
          <stop offset="0.35" stop-color="#e6edf4" />
          <stop offset="0.6" stop-color="#b9c6d6" />
          <stop offset="1" stop-color="#7d8fa3" />
        </linearGradient>
      </defs>

      {/* Scale ticks every 250. */}
      <For each={[0, 250, 500, 750, 1000]}>
        {(value) => (
          <>
            <line
              class={styles.scaleTick}
              x1={TUBE_X - 9}
              x2={TUBE_X - 2}
              y1={yFor(value)}
              y2={yFor(value)}
            />
            <text
              class={styles.scaleLabel}
              x={TUBE_X - 12}
              y={yFor(value) + 2.5}
              text-anchor="end"
            >
              {value}
            </text>
          </>
        )}
      </For>

      {/* The glass tube. It runs down INTO the bulb; the bulb is
          painted over its bottom, so no cap is ever stroked across
          the mercury ball. */}
      <rect
        class={styles.glass}
        x={TUBE_X}
        y={TUBE_GLASS_TOP}
        width={TUBE_W}
        height={TUBE_GLASS_HEIGHT}
        rx={TUBE_W / 2}
      />
      <Show when={props.missingCount > 0}>
        <line
          class={styles.dashedCap}
          x1={TUBE_X + 2}
          x2={TUBE_X + TUBE_W - 2}
          y1={TUBE_TOP - 20}
          y2={TUBE_TOP - 20}
        >
          <title>{`${props.missingCount} faculties not yet measured`}</title>
        </line>
      </Show>

      {/* Mercury in the tube, only as high as the last calibration. */}
      <Show when={props.calibrated !== null}>
        <rect
          class={styles.mercuryFill}
          x={TUBE_X + 5}
          width={TUBE_W - 10}
          y={fillY()}
          height={BULB_CY - fillY()}
          rx={(TUBE_W - 10) / 2}
          fill="url(#ear-mercury)"
        />
        {/* Specular strip on the mercury itself — never on empty
            glass, which read as a floating white blob. */}
        <rect
          class={styles.mercuryFill}
          x={TUBE_X + 8}
          y={fillY() + 8}
          width={4.5}
          height={Math.max(0, BULB_CY - fillY() - 20)}
          rx={2.25}
          fill="#ffffff"
          opacity="0.28"
        />
      </Show>

      <rect
        class={styles.glassStroke}
        x={TUBE_X}
        y={TUBE_GLASS_TOP}
        width={TUBE_W}
        height={TUBE_GLASS_HEIGHT}
        rx={TUBE_W / 2}
      />

      {/* The bulb, drawn last: always charged, and opaque enough to
          hide where the tube ends. */}
      <circle
        class={styles.mercury}
        cx={TUBE_X + TUBE_W / 2}
        cy={BULB_CY}
        r={BULB_R - 4}
        fill="url(#ear-mercury)"
      />
      <circle
        class={styles.glassStroke}
        cx={TUBE_X + TUBE_W / 2}
        cy={BULB_CY}
        r={BULB_R}
      />

      {/* Etched marks: every past calibration, dated. */}
      <For each={shownMarks()}>
        {(mark) => (
          <>
            <line
              class={styles.mark}
              x1={TUBE_X + TUBE_W + 2}
              x2={TUBE_X + TUBE_W + 12}
              y1={yFor(mark.index)}
              y2={yFor(mark.index)}
            />
            <text
              class={styles.markLabel}
              x={TUBE_X + TUBE_W + 15}
              y={yFor(mark.index) + 2.5}
            >
              {markLabel(mark.at)} · {mark.index}
            </text>
          </>
        )}
      </For>

      {/* The meniscus: where practice says the ear already is. */}
      <Show when={props.estimate > 0}>
        <line
          class={styles.meniscus}
          x1={TUBE_X - 6}
          x2={TUBE_X + TUBE_W + 6}
          y1={yFor(props.estimate)}
          y2={yFor(props.estimate)}
        >
          <title>{`Practice estimate: ${props.estimate}`}</title>
        </line>
      </Show>
    </svg>
  )
}
