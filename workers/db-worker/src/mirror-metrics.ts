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

/** Which tour, and which step of it. Tour ids never change and are integers. */
export const TOUR_METRIC_KEYS: ReadonlySet<string> = new Set(['tour', 'step'])

// Typed against the catalog: renaming `results_view` breaks the typecheck here
// instead of silently dropping its metrics. The tour entries are built from
// TOUR_FUNNEL_EVENTS, so they follow a rename by construction.
const METRIC_KEYS_BY_EVENT = new Map<FunnelEventName, ReadonlySet<string>>([
  ['results_view', MIRROR_METRIC_KEYS],
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
