// ============================================================
// Ticking a routine segment by hand
// ============================================================
//
// The tick predates segments being real exercises. Back when a warm-up
// was a note telling you to do lip rolls, ticking it was the ONLY way to
// record it. Now most segments launch a scored drill that records its
// own result and advances the routine — so ticking one by hand marks it
// done without singing a note, and the streak, the calendar and the
// badge engine all count a run that never happened.
//
// Not removed, because two honest cases remain: practising away from the
// app, and a drill that failed to record. Both are real, and blocking
// them would push people into faking progress some other way. So the
// tick stays and asks first, and only for segments that would otherwise
// have recorded themselves.

import type { RoutineSegment } from './types'

/**
 * True when finishing this segment properly would record its own result.
 *
 * `config.exercise` is the tell: those segments launch the exercise
 * engine, which writes a SessionRecord and completes the segment on the
 * way out. A guided warm-up or cool-down carries only a `pattern` — it
 * produces no score, so there is nothing for a hand-tick to falsify and
 * it keeps the plain one-click behaviour.
 */
export function segmentSelfReports(seg: RoutineSegment | undefined): boolean {
  return seg?.config?.exercise !== undefined
}

/** What to ask before letting someone tick a scored segment. */
export function manualCompletePrompt(seg: RoutineSegment | undefined): {
  title: string
  message: string
} {
  const name = seg?.config?.exercise ?? 'this drill'
  return {
    title: 'Mark it done without singing?',
    message:
      `${name} records its own score when you finish it, and that score ` +
      'feeds your streak, your calendar and your badges. Ticking it by ' +
      'hand marks the segment complete but records no practice. Do that ' +
      'only if you sang it away from the app, or it failed to save.',
  }
}
