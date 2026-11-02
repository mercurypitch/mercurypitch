// Studio meter text — the numbers beside a meter follow its level eight times a second; its bars follow every reading.
//
// The transport reads levels every 33 ms. A bar moves with each reading,
// but a number rewritten thirty times a second is a blur no one reads,
// and every rewrite costs the page a style pass and a paint, on each of
// up to 24 lane meters. So a meter's text takes a reading at most every
// STUDIO_METER_TEXT_MS, and at once when its reading starts, stops or
// begins a new measurement (a seek, a run taking over).
import type { Accessor } from 'solid-js'
import { createMemo } from 'solid-js'

/** How often the numbers beside a meter follow its level: eight times a second. */
export const STUDIO_METER_TEXT_MS = 125

/**
 * `reading` as a meter's text shows it: the latest one at most every
 * STUDIO_METER_TEXT_MS while `continues` says it carries on from the one
 * shown, and at once otherwise. No reading (null) shows at once.
 */
export function createMeterText<T extends object>(
  reading: Accessor<T | null>,
  continues: (shown: T, next: T) => boolean = () => true,
  now: () => number = () => performance.now(),
): Accessor<T | null> {
  let shownAt = -Infinity
  const text = createMemo<T | null>((shown) => {
    const next = reading()
    if (next === null) return null
    const at = now()
    if (
      shown !== null &&
      continues(shown, next) &&
      at - shownAt < STUDIO_METER_TEXT_MS
    )
      return shown
    shownAt = at
    return next
  }, null)
  return text
}
