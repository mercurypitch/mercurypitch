// ============================================================
// ReadingTrace — one reading over time, engraved on a plate.
//
// A threshold falls as the ear improves, so a threshold trace is
// plotted inverted: the line rises as the number falls, and the axis
// stays honest — the smallest value is printed at the top. Sealed
// calibrations are brass marks joined by a brass line; practice is
// the fainter silver dashed line. The Mercury Index uses the same
// instrument the natural way up: higher is better, printed at the top.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { dateLabel } from './instruments'
import styles from './ReadingTrace.module.css'

export interface TracePoint {
  at: number
  value: number
  /** A sealed calibration (brass) rather than practice (silver). */
  sealed: boolean
}

interface ReadingTraceProps {
  /** For the spoken summary: "Hairline threshold". */
  label: string
  points: readonly TracePoint[]
  /** Printed after each axis value: '¢', ' ms', ''. */
  unit: string
  decimals: number
  /** Smaller is better: the smallest value sits at the top. */
  invert?: boolean
  /** Fixed axis bounds (the index runs 0..1000); fitted otherwise. */
  domain?: readonly [number, number]
  /** The window the x axis spans. */
  from: number
  to: number
}

const W = 560
const H = 200
const LEFT = 60
const RIGHT = 540
const TOP = 30
const BOTTOM = 160
const GRID_ROWS = [TOP, (TOP + BOTTOM) / 2, BOTTOM]

/** Axis bounds that keep the trace off the frame: a fitted domain is
 *  padded by a twelfth on each side, and a flat trace gets a band
 *  around it so a single reading still has an axis to read. */
export function fitDomain(
  values: readonly number[],
  fixed?: readonly [number, number],
): [number, number] {
  if (fixed) return [fixed[0], fixed[1]]
  if (values.length === 0) return [0, 1]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (hi === lo) {
    const band = Math.max(Math.abs(lo) * 0.25, 1)
    return [lo - band, hi + band]
  }
  const pad = (hi - lo) / 12
  return [lo - pad, hi + pad]
}

export function ReadingTrace(props: ReadingTraceProps): JSX.Element {
  const sorted = createMemo(() => [...props.points].sort((a, b) => a.at - b.at))
  const domain = createMemo(() =>
    fitDomain(
      sorted().map((p) => p.value),
      props.domain,
    ),
  )

  const invert = () => props.invert === true

  const y = (value: number): number => {
    const [lo, hi] = domain()
    const t = hi === lo ? 0.5 : (value - lo) / (hi - lo)
    return invert() ? TOP + t * (BOTTOM - TOP) : BOTTOM - t * (BOTTOM - TOP)
  }
  const x = (at: number): number => {
    const span = props.to - props.from
    if (span <= 0) return (LEFT + RIGHT) / 2
    const t = Math.min(1, Math.max(0, (at - props.from) / span))
    return LEFT + t * (RIGHT - LEFT)
  }
  const fmt = (value: number) => `${value.toFixed(props.decimals)}${props.unit}`

  /** The value printed beside each grid row, top to bottom. */
  const rowValues = () => {
    const [lo, hi] = domain()
    const mid = (lo + hi) / 2
    return invert() ? [lo, mid, hi] : [hi, mid, lo]
  }

  const practice = () => sorted().filter((p) => !p.sealed)
  const sealed = () => sorted().filter((p) => p.sealed)
  const polyline = (list: readonly TracePoint[]) =>
    list.map((p) => `${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')

  const summary = () => {
    const list = sorted()
    const how = invert()
      ? 'plotted inverted, so rising means improving'
      : 'higher is better'
    if (list.length === 0) return `${props.label}: nothing in this range.`
    const first = list[0]
    const last = list[list.length - 1]
    if (list.length === 1) {
      return `${props.label}: ${fmt(first.value)} on ${dateLabel(first.at)}; ${how}.`
    }
    return `${props.label}: from ${fmt(first.value)} on ${dateLabel(first.at)} to ${fmt(last.value)} on ${dateLabel(last.at)}; ${how}.`
  }

  return (
    <svg
      class={styles.trace}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={summary()}
      data-testid="ear-trace"
      data-points={sorted().length}
    >
      <g class={styles.grid}>
        <For each={GRID_ROWS}>
          {(row) => <line x1={LEFT} y1={row} x2={RIGHT} y2={row} />}
        </For>
      </g>
      <g class={styles.axis}>
        <For each={rowValues()}>
          {(value, i) => (
            <text
              x={LEFT - 8}
              y={GRID_ROWS[i()] + 4}
              text-anchor="end"
              data-axis="y"
            >
              {fmt(value)}
            </text>
          )}
        </For>
        <text x={LEFT} y={H - 14} data-axis="x">
          {dateLabel(props.from)}
        </text>
        <text
          x={(LEFT + RIGHT) / 2}
          y={H - 14}
          text-anchor="middle"
          data-axis="x"
        >
          {dateLabel((props.from + props.to) / 2)}
        </text>
        <text x={RIGHT} y={H - 14} text-anchor="end" data-axis="x">
          {dateLabel(props.to)}
        </text>
      </g>
      <Show when={practice().length > 1}>
        <polyline class={styles.practice} points={polyline(practice())} />
      </Show>
      <For each={practice()}>
        {(p) => (
          <circle class={styles.dot} cx={x(p.at)} cy={y(p.value)} r={2.6} />
        )}
      </For>
      <Show when={sealed().length > 1}>
        <polyline class={styles.sealed} points={polyline(sealed())} />
      </Show>
      <For each={sealed()}>
        {(p) => (
          <circle class={styles.mark} cx={x(p.at)} cy={y(p.value)} r={4.5} />
        )}
      </For>
    </svg>
  )
}
