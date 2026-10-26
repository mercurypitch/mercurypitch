// ============================================================
// mirror-metrics — which numbers a funnel event may keep
// ============================================================
//
// The ingest stores an event's name and, for a few events, a small JSON of
// numbers. An event with no entry in METRIC_KEYS_BY_EVENT stores nothing, so a
// client cannot park arbitrary data in mirrorEvents by naming a key.
//
// One rule for every event that has an entry: an object payload (not an
// array) yields its filtered JSON (even `{}` when no key survives), anything
// else (a string, a number, null, an array) yields null. Values are numbers
// or null; a string never gets through, so free text cannot ride along.
//
// A lesson answer is held to more: the route refuses it whole unless all
// seven of its numbers are integers in range (lessonAnswerInBounds), so no
// row it keeps can carry a number its pages never send.
//
// The lookup is a Map, not an object: `cleanMirrorMetrics` takes the event
// name as a plain string, and `constructor` or `__proto__` must never find an
// allowlist through the prototype.

import type { FunnelEventName } from '../../../src/lib/funnel-event-catalog'
import { TOUR_FUNNEL_EVENTS } from '../../../src/lib/funnel-event-catalog'

// Derived numbers only (range/accuracy/steadiness) — never audio.
export const MIRROR_METRIC_KEYS: ReadonlySet<string> = new Set([
  'lowMidi',
  'highMidi',
  'semitones',
  'accuracy',
  'steadiness',
])

/**
 * Which tour, which step of it, and how many steps that run showed. Tour ids
 * never change and are integers.
 */
export const TOUR_METRIC_KEYS: ReadonlySet<string> = new Set([
  'tour',
  'step',
  'of',
])

/**
 * A lesson page's answer (src/features/lessons/kit/telemetry.ts): the page it
 * came from, the question's lesson and number (`l04-q1` is 4 and 1), whether
 * the visit's first answer to it was right (1 or 0), its number of options
 * for the guess correction (MASTER-PLAN § 9), the visit, and the consent it
 * was sent under (1 granted, 2 never asked). Each with its range, both ends
 * included.
 *
 * The pages are Lessons 1 to 14. Every quiz asks questions `q1` to `q4` (the
 * 17 createQuiz sites in src/features/lessons, October 2026), so a fifth
 * question widens `q` here first. A question has 2 to 6 options, and `visit`
 * is the first, the second or a later one (telemetry.ts caps it at 3).
 */
export const LESSON_ANSWER_BOUNDS: ReadonlyMap<
  string,
  readonly [min: number, max: number]
> = new Map<string, readonly [number, number]>([
  ['page', [1, 14]],
  ['qLesson', [1, 14]],
  ['q', [1, 4]],
  ['firstTry', [0, 1]],
  ['k', [2, 6]],
  ['visit', [1, 3]],
  ['consent', [1, 2]],
])

/** The seven numbers a lesson answer keeps, read off its ranges. */
export const LESSON_ANSWER_METRIC_KEYS: ReadonlySet<string> = new Set(
  LESSON_ANSWER_BOUNDS.keys(),
)

/**
 * Whether a lesson answer's metrics hold all seven numbers, each an integer
 * in its range. The route refuses the whole event when not: a lesson answer
 * with a number missing, fractional or out of range is not one the pages
 * send. A key outside the seven is dropped, as on every event.
 */
export function lessonAnswerInBounds(metrics: unknown): boolean {
  if (typeof metrics !== 'object' || metrics === null) return false
  if (Array.isArray(metrics)) return false
  const record = metrics as Record<string, unknown>
  for (const [key, [min, max]] of LESSON_ANSWER_BOUNDS) {
    const value = Object.hasOwn(record, key) ? record[key] : undefined
    if (!Number.isInteger(value)) return false
    if ((value as number) < min || (value as number) > max) return false
  }
  return true
}

// Typed against the catalog: renaming `results_view` breaks the typecheck here
// instead of silently dropping its metrics. The tour entries are built from
// TOUR_FUNNEL_EVENTS, so they follow a rename by construction.
const METRIC_KEYS_BY_EVENT = new Map<FunnelEventName, ReadonlySet<string>>([
  ['results_view', MIRROR_METRIC_KEYS],
  ['lesson_answer', LESSON_ANSWER_METRIC_KEYS],
  ...TOUR_FUNNEL_EVENTS.map((event): [FunnelEventName, ReadonlySet<string>] => [
    event,
    TOUR_METRIC_KEYS,
  ]),
])

const metricKeysFor = (event: string): ReadonlySet<string> | undefined =>
  (METRIC_KEYS_BY_EVENT as ReadonlyMap<string, ReadonlySet<string>>).get(event)

/** The metrics JSON to store for `event`, or null when it stores none. */
export function cleanMirrorMetrics(
  event: string,
  metrics: unknown,
): string | null {
  const allowed = metricKeysFor(event)
  if (
    !allowed ||
    typeof metrics !== 'object' ||
    metrics === null ||
    Array.isArray(metrics)
  ) {
    return null
  }
  const clean: Record<string, number | null> = {}
  for (const [key, value] of Object.entries(metrics)) {
    if (allowed.has(key) && (typeof value === 'number' || value === null)) {
      clean[key] = value
    }
  }
  return JSON.stringify(clean)
}
