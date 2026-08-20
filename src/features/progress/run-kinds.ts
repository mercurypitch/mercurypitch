// ============================================================
// Run kinds — what counts as what, in one place
// ============================================================
//
// "Session" meant three different things in this app, on three screens that
// sat next to each other:
//
//   - Vocal Analysis "Sessions"  — practice runs, this browser only
//   - Community runs list        — every recorded run, from the cloud
//   - "Shared: 4 sessions"       — published setlists, not runs at all
//
// Three counters, three definitions, one word. Somebody who had done
// nineteen exercises and thirteen challenges read "0 sessions" and concluded
// the app had lost their work.
//
// So the taxonomy lives here, once, and every surface that shows a number
// derives its label, its colour and its explanation from this file. A new
// kind of run is added in one place or it is inconsistent everywhere.

import type { SessionRecord, SessionSource } from '@/db/entities'
import type { SessionResult } from '@/types'

/** The four things a singer can do that get recorded as a run. */
export type RunKind = SessionSource

export interface RunKindMeta {
  kind: RunKind
  /** Shown on the pill. Singular — the count sits beside it. */
  label: string
  /** One line, for the legend and the guide. */
  blurb: string
  /**
   * Whether the run is comparable between people, which is the real reason
   * the kinds are separated at all: free singing over a melody you chose
   * yourself cannot be ranked against anybody, so it is never on a board.
   */
  ranked: boolean
  /** CSS custom-property suffix; see progress-pills.module.css. */
  tone: 'practice' | 'exercise' | 'challenge' | 'weekly'
}

/**
 * Declaration order is display order, and it runs from the least structured
 * to the most: what you sang for yourself, then a drill, then a set task,
 * then the one everybody sings the same week.
 */
export const RUN_KINDS: readonly RunKindMeta[] = [
  {
    kind: 'practice',
    label: 'Practice',
    blurb:
      'Free singing over a melody you picked yourself. Scored for you, never ranked against anyone — the difficulty was your choice.',
    ranked: false,
    tone: 'practice',
  },
  {
    kind: 'exercise',
    label: 'Exercise',
    blurb:
      'A drill from the exercise library. Fixed material, so your own runs are comparable with each other over time.',
    ranked: false,
    tone: 'exercise',
  },
  {
    kind: 'challenge',
    label: 'Challenge',
    blurb:
      'A set task with a fixed target. Everyone sings the same thing, so these are ranked.',
    ranked: true,
    tone: 'challenge',
  },
  {
    kind: 'weekly',
    label: 'Weekly',
    blurb:
      'Sing the Legend — the week’s shared take. Ranked, and the board resets when the week does.',
    ranked: true,
    tone: 'weekly',
  },
]

const BY_KIND = new Map<RunKind, RunKindMeta>(
  RUN_KINDS.map((meta) => [meta.kind, meta]),
)

/**
 * The kind a stored run belongs to.
 *
 * Rows written before `source` existed carry nothing, and the entity comment
 * is explicit that those are practice — so an absent source is not unknown,
 * it is the oldest answer.
 */
export function runKindOf(source: SessionSource | null | undefined): RunKind {
  return source !== null && source !== undefined && BY_KIND.has(source)
    ? source
    : 'practice'
}

export function runKindMeta(kind: RunKind): RunKindMeta {
  const meta = BY_KIND.get(kind)
  return meta === undefined ? RUN_KINDS[0] : meta
}

/**
 * One run, in the shape every progress surface reads.
 *
 * Deliberately narrower than either source it is built from. The cloud row
 * and the local one disagree about almost everything — field names, time
 * format, whether a source is recorded at all — and letting that difference
 * past this boundary is what produced three screens that counted three
 * different things.
 */
export interface ProgressRun {
  kind: RunKind
  /** 0-100. */
  score: number
  /** Epoch milliseconds. */
  completedAt: number
  /**
   * Whether per-note pitch detail was kept for this run.
   *
   * The score trend is drawn only from runs that have it — a line through
   * runs with no pitch data behind them would be a chart of nothing. The
   * COUNT deliberately does not care: the run happened either way, and a
   * tile that hides it is how "0 sessions" got shown to somebody who had
   * practised forty times.
   */
  hasNoteDetail: boolean
}

function finiteScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0
}

/** A cloud row, normalised. */
export function runFromRecord(record: SessionRecord): ProgressRun | null {
  const at = Date.parse(record.endedAt)
  if (!Number.isFinite(at)) return null
  return {
    kind: runKindOf(record.source),
    score: finiteScore(record.score),
    completedAt: at,
    // The cloud row has never carried per-note detail: `results` is written
    // as `[]` by every producer. Kept as a field rather than hardcoded false
    // at the call site, so the day it does carry detail this is the one line
    // that changes.
    hasNoteDetail: Array.isArray(record.results) && record.results.length > 0,
  }
}

/** A device-local practice run, normalised. */
export function runFromLocalResult(result: SessionResult): ProgressRun | null {
  if (!Number.isFinite(result.completedAt)) return null
  const items = Array.isArray(result.practiceItemResult)
    ? result.practiceItemResult
    : []
  return {
    // The local signal is only ever written by `endPracticeSession`, so
    // every entry in it is a practice run by construction.
    kind: 'practice',
    score: finiteScore(result.score),
    completedAt: result.completedAt,
    hasNoteDetail: items.some(
      (item) => Array.isArray(item.noteResult) && item.noteResult.length > 0,
    ),
  }
}

export interface RunKindCount {
  meta: RunKindMeta
  count: number
}

/**
 * How many runs of each kind, in declaration order.
 *
 * Kinds with no runs are kept rather than dropped: the point of showing the
 * breakdown is to answer "where did my work go", and a kind that is missing
 * from the row cannot answer that. The view decides whether to dim a zero.
 */
export function countRunsByKind(
  runs: readonly ProgressRun[],
): readonly RunKindCount[] {
  const tally = new Map<RunKind, number>()
  for (const run of runs) {
    tally.set(run.kind, (tally.get(run.kind) ?? 0) + 1)
  }
  return RUN_KINDS.map((meta) => ({
    meta,
    count: tally.get(meta.kind) ?? 0,
  }))
}

/** Runs newest-last, which is the order a trend line is drawn in. */
export function inTimeOrder(
  runs: readonly ProgressRun[],
): readonly ProgressRun[] {
  return [...runs].sort((left, right) => left.completedAt - right.completedAt)
}

/** The best score across every run, whatever kind it was. */
export function bestScore(runs: readonly ProgressRun[]): number {
  return runs.reduce((best, run) => Math.max(best, run.score), 0)
}

/**
 * Mean score across the most recent runs — "where you are now", against the
 * best-ever that "where you've been" already answers.
 *
 * Counts from the newest end of time order, so it does not depend on the
 * caller having sorted anything. Returns 0 for no runs, which the view is
 * expected to hide rather than print: "recent average 0%" is a bad result,
 * not an empty one.
 */
export function recentAverageScore(
  runs: readonly ProgressRun[],
  count = 5,
): number {
  const recent = inTimeOrder(runs).slice(-Math.max(1, count))
  if (recent.length === 0) return 0
  const total = recent.reduce((sum, run) => sum + run.score, 0)
  return Math.round(total / recent.length)
}

/**
 * Narrowing filter for the `null`s that `runFromRecord`/`runFromLocalResult`
 * return for rows they refuse. Exported because every caller that maps a
 * stored list into runs needs it, and three copies of the same predicate is
 * how one of them ends up subtly different.
 */
export function isProgressRun(run: ProgressRun | null): run is ProgressRun {
  return run !== null
}
