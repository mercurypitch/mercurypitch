// ============================================================
// A reading over time, as the Ear Report draws it in the room's light
// (docs/plans/ear-lab-native-look.md, "The Ear Report"): sealed
// calibrations are bright marks on a lit line, practice the dashed line
// under them. A threshold falls as the ear sharpens, so it is drawn the
// other way up and its line climbs; the axis prints its real values at
// either end, the finer at the top. The Index is drawn the natural way
// up, shaded under its line.
//
// The colours are the card's station lights (`--station-a`), and the
// drawing is as wide as its card: measured, so its words stay at 13px on
// a wide screen rather than growing with it.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show, } from 'solid-js'
import { dateLabel } from '../instruments'
import type { TracePoint } from '../report-data'
import { fitDomain, roundDomain } from '../report-data'
import styles from './report.module.css'

export interface HistoryChartProps {
  /** For the spoken summary: "Hairline", "The Mercury Index". */
  label: string
  points: readonly TracePoint[]
  /** The window the x axis spans. */
  from: number
  to: number
  /** Smaller is better: the smallest value at the top. */
  invert?: boolean
  /** Fixed axis bounds; fitted to the points otherwise. */
  domain?: readonly [number, number]
  /** A value as the summary says it: "16.0 ¢". */
  format: (value: number) => string
  /** A value as the axis prints it, if not as the summary: "10 ¢". */
  tick?: (value: number) => string
  /** Shade under the sealed line. */
  area?: boolean
}

/** The drawing's height: the lines, then the dates under them. */
const LINES_H = 112
const H = LINES_H + 26
const TOP = 18
const BOTTOM = LINES_H - 8
const PAD_X = 6
/** Before the card is measured, a phone's card. */
const FALLBACK_W = 326

export function HistoryChart(props: HistoryChartProps): JSX.Element {
  const id = createUniqueId()
  const [width, setWidth] = createSignal(FALLBACK_W)
  let box: HTMLDivElement | undefined
  onMount(() => {
    if (box === undefined) return
    const measure = (): void => {
      const w = box?.clientWidth ?? 0
      if (w > 0) setWidth(w)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    onCleanup(() => observer.disconnect())
  })

  const sorted = createMemo(() => [...props.points].sort((a, b) => a.at - b.at))
  const domain = createMemo((): [number, number] => {
    if (props.domain !== undefined) return [props.domain[0], props.domain[1]]
    const values = sorted().map((p) => p.value)
    const [lo, hi] = roundDomain(fitDomain(values))
    // A reading is never below nothing, so neither is its axis.
    return [values.every((v) => v >= 0) ? Math.max(0, lo) : lo, hi]
  })
  const x = (at: number): number => {
    const span = props.to - props.from
    const t =
      span <= 0 ? 0.5 : Math.min(1, Math.max(0, (at - props.from) / span))
    return PAD_X + t * (width() - 2 * PAD_X)
  }
  const y = (value: number): number => {
    const [lo, hi] = domain()
    const t = hi === lo ? 0.5 : (value - lo) / (hi - lo)
    return props.invert === true
      ? TOP + t * (BOTTOM - TOP)
      : BOTTOM - t * (BOTTOM - TOP)
  }
  const at = (p: TracePoint): string =>
    `${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`
  const practice = () => sorted().filter((p) => !p.sealed)
  const sealed = () => sorted().filter((p) => p.sealed)

  /** The values printed at the top and the bottom line. */
  const ends = (): [number, number] => {
    const [lo, hi] = domain()
    return props.invert === true ? [lo, hi] : [hi, lo]
  }
  const dates = (): { at: number; anchor: 'start' | 'middle' | 'end' }[] => [
    { at: props.from, anchor: 'start' },
    { at: (props.from + props.to) / 2, anchor: 'middle' },
    { at: props.to, anchor: 'end' },
  ]

  const summary = (): string => {
    const list = sorted()
    const how =
      props.invert === true ? 'drawn so rising means finer' : 'higher is better'
    if (list.length === 0) return `${props.label}: nothing in this range.`
    const first = list[0]
    const last = list[list.length - 1]
    const marks = sealed().length
    const seals = marks === 0 ? '' : `, ${marks} sealed`
    if (list.length === 1) {
      return `${props.label}: ${props.format(first.value)} on ${dateLabel(first.at)}${seals}; ${how}.`
    }
    return `${props.label}: from ${props.format(first.value)} on ${dateLabel(first.at)} to ${props.format(last.value)} on ${dateLabel(last.at)}${seals}; ${how}.`
  }

  return (
    <div ref={box} class={styles.chart}>
      <svg
        viewBox={`0 0 ${width()} ${H}`}
        width={width()}
        height={H}
        role="img"
        aria-label={summary()}
        data-testid="report-trace"
        data-points={sorted().length}
        data-sealed={sealed().length}
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" class={styles.areaTop} />
            <stop offset="1" class={styles.areaBottom} />
          </linearGradient>
        </defs>
        <For each={[TOP, (TOP + BOTTOM) / 2, BOTTOM]}>
          {(row) => (
            <line
              class={styles.gridLine}
              x1={0}
              x2={width()}
              y1={row}
              y2={row}
            />
          )}
        </For>
        <For each={ends()}>
          {(value, i) => (
            <text
              class={styles.axisText}
              x={width()}
              y={(i() === 0 ? TOP : BOTTOM) - 5}
              text-anchor="end"
              data-axis="y"
            >
              {(props.tick ?? props.format)(value)}
            </text>
          )}
        </For>
        <Show when={practice().length > 0}>
          <polyline
            class={styles.practiceLine}
            points={practice().map(at).join(' ')}
          />
          <For each={practice()}>
            {(p) => (
              <circle
                class={styles.practiceDot}
                cx={x(p.at)}
                cy={y(p.value)}
                r={2.6}
              />
            )}
          </For>
        </Show>
        <Show when={sealed().length > 1}>
          <Show when={props.area === true}>
            <polygon
              fill={`url(#${id}-area)`}
              points={`${sealed().map(at).join(' ')} ${x(sealed()[sealed().length - 1].at).toFixed(1)},${BOTTOM} ${x(sealed()[0].at).toFixed(1)},${BOTTOM}`}
            />
          </Show>
          <polyline
            class={styles.sealedGlow}
            points={sealed().map(at).join(' ')}
          />
          <polyline
            class={styles.sealedLine}
            points={sealed().map(at).join(' ')}
          />
        </Show>
        <For each={sealed()}>
          {(p) => (
            <g data-mark="sealed">
              <circle
                class={styles.sealedHalo}
                cx={x(p.at)}
                cy={y(p.value)}
                r={10}
              />
              <circle
                class={styles.sealedMark}
                cx={x(p.at)}
                cy={y(p.value)}
                r={4.6}
              />
            </g>
          )}
        </For>
        <For each={dates()}>
          {(date) => (
            <text
              class={styles.axisText}
              x={
                date.anchor === 'start'
                  ? 0
                  : date.anchor === 'end'
                    ? width()
                    : width() / 2
              }
              y={LINES_H + 20}
              text-anchor={date.anchor}
              data-axis="x"
            >
              {dateLabel(date.at)}
            </text>
          )}
        </For>
      </svg>
    </div>
  )
}
