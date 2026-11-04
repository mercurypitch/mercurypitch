// ============================================================
// The Ear Report's data, read the same way by the web's report
// (EarReport.tsx) and the native one (merc/MercReport.tsx): the ranges
// the traces can span, the drills it reports, where a range starts, and
// how a trace's axis is fitted.
//
// Confusion rates use tap-item attempts (mic answers do not touch
// items), so a rate is perception against a stable yardstick. Contour's
// expected labels are directions, not items: no per-item denominator
// exists, so its sentences count and its map has no diagonal.
// ============================================================

import type { EarBankItem } from '@/lib/ear/banks'
import { bankItemState, LEAP_BANK, STACK_BANK } from '@/lib/ear/banks'
import type { HomeDegree } from '@/lib/ear/item-bank'
import { HOME_DEGREES, homeItemState } from '@/lib/ear/item-bank'
import { calibrationHistory, earItemStates, thresholdHistory, } from '@/stores/ear-lab-store'

export type ReportRange = '4w' | '12w' | 'all'

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** The ranges the traces can span, the shortest first; null is all. */
export const REPORT_RANGES: readonly {
  readonly id: ReportRange
  readonly weeks: number | null
}[] = [
  { id: '4w', weeks: 4 },
  { id: '12w', weeks: 12 },
  { id: 'all', weeks: null },
]

/** The range a report opens on. */
export const DEFAULT_REPORT_RANGE: ReportRange = '12w'

/** The threshold drills the report traces, each with its history. */
export const REPORT_THRESHOLDS = ['hairline', 'the-grid'] as const

export interface ConfusionSection {
  drillId: string
  title: string
  /** Confusion-key labels in axis order. */
  labels: string[]
  /** Display name per label: the web's axis ticks and sentences. */
  display: (label: string) => string
  /** The name the native report says in a sentence: "Fa", "Minor 3rd",
   *  "Major", "Up". */
  spoken: (label: string) => string
  /** The name on the native map's axis, a few letters: "Fa", "m3",
   *  "Maj", "Up". */
  short: (label: string) => string
  /** Tap attempts for a label's item (rate denominator). */
  attemptsFor: (label: string) => number
  /** The drill keeps a count per item, so its map has a diagonal of
   *  right answers; Contour's directions are no items. */
  items: boolean
}

function homeDegree(label: string): HomeDegree | undefined {
  return HOME_DEGREES.find((d) => `deg-${d.degree}` === label)
}

function bankItem(
  bank: readonly EarBankItem[],
  label: string,
): EarBankItem | undefined {
  return bank.find((item) => item.itemId === label)
}

/** "up" as "Up". */
function capitalised(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** The identification drills the report maps, each with its mix-ups. */
export const CONFUSION_SECTIONS: readonly ConfusionSection[] = [
  {
    drillId: 'home',
    title: 'Home',
    labels: HOME_DEGREES.map((d) => `deg-${d.degree}`),
    display: (label) => {
      const degree = homeDegree(label)
      return degree ? `${degree.solfege} (${degree.degree})` : label
    },
    spoken: (label) => homeDegree(label)?.solfege ?? label,
    short: (label) => homeDegree(label)?.solfege ?? label,
    attemptsFor: (label) => {
      const degree = Number(label.replace('deg-', ''))
      return homeItemState(earItemStates(), degree).attempts
    },
    items: true,
  },
  {
    drillId: 'leap',
    title: 'Leap',
    labels: LEAP_BANK.map((item) => item.itemId),
    display: (label) => bankItem(LEAP_BANK, label)?.label ?? label,
    spoken: (label) => bankItem(LEAP_BANK, label)?.name ?? label,
    short: (label) => bankItem(LEAP_BANK, label)?.label ?? label,
    attemptsFor: (label) => {
      const item = bankItem(LEAP_BANK, label)
      return item ? bankItemState(earItemStates(), item).attempts : 0
    },
    items: true,
  },
  {
    drillId: 'stack',
    title: 'Stack',
    labels: STACK_BANK.map((item) => item.itemId),
    display: (label) => bankItem(STACK_BANK, label)?.name ?? label,
    spoken: (label) => bankItem(STACK_BANK, label)?.name ?? label,
    short: (label) => bankItem(STACK_BANK, label)?.label ?? label,
    attemptsFor: (label) => {
      const item = bankItem(STACK_BANK, label)
      return item ? bankItemState(earItemStates(), item).attempts : 0
    },
    items: true,
  },
  {
    drillId: 'contour',
    title: 'Contour',
    labels: ['up', 'down', 'same'],
    display: (label) => label,
    spoken: capitalised,
    short: capitalised,
    attemptsFor: () => 0,
    items: false,
  },
]

/** The oldest timestamp on file, the All range's left edge; a week ago
 *  with nothing on file. */
export function reportEarliest(now: number): number {
  const stamps = [
    ...calibrationHistory().map((run) => run.at),
    ...REPORT_THRESHOLDS.flatMap((id) => thresholdHistory(id).map((r) => r.at)),
  ]
  return stamps.length > 0 ? Math.min(...stamps) : now - WEEK_MS
}

/** Where a range starts, ms. */
export function reportFrom(
  range: ReportRange,
  now: number,
  earliest: number,
): number {
  const weeks = REPORT_RANGES.find((r) => r.id === range)?.weeks ?? null
  return weeks === null ? earliest : now - weeks * WEEK_MS
}

/** One reading on a trace. */
export interface TracePoint {
  at: number
  value: number
  /** A sealed calibration rather than practice. */
  sealed: boolean
}

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

/**
 * A fitted domain widened to a round step, so an axis prints 250 and 180
 * rather than 247 and 186: the step is the power of ten no larger than the
 * span. The native report's traces (merc/HistoryChart.tsx) read it.
 */
export function roundDomain([lo, hi]: readonly [number, number]): [
  number,
  number,
] {
  const span = hi - lo
  if (!(span > 0)) return [lo, hi]
  const step = 10 ** Math.floor(Math.log10(span))
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step]
}
