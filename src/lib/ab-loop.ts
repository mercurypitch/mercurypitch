// ============================================================
// A-B loop math — pure, framework-free helpers shared by the
// Singing tab's loop UI (App.tsx wires the signals, SingingStatusBar
// draws the region). Extracted so the boundary/seek/geometry rules
// are unit-testable in isolation and mirror the canonical stem-mixer
// loop (see useStemMixerAudioController.ts).
//
// Beats are the unit throughout: `a` = loop start, `b` = loop end,
// 0 means "not set". A loop is only valid when 0 < a < b.
// ============================================================

export interface LoopState {
  /** Whether the loop toggle is on. */
  enabled: boolean
  /** Loop start (beats); 0 = unset. */
  a: number
  /** Loop end (beats); 0 = unset. */
  b: number
  /**
   * True while the user has manually seeked outside [a, b): loop-back is
   * suppressed until playback re-enters the region (mirrors the stem-mixer's
   * `seekedOutsideLoop` escape flag).
   */
  seekedOutside: boolean
}

/**
 * Should the playhead jump back to A on this tick?
 *
 * True iff the loop is enabled, valid (b > 0 and a < b), the user has not
 * escaped it via a manual seek, and the playhead has reached B.
 */
export const shouldLoopBack = (beat: number, state: LoopState): boolean =>
  state.enabled &&
  state.b > 0 &&
  state.a < state.b &&
  !state.seekedOutside &&
  beat >= state.b

/**
 * Is a seek to `target` landing outside the active loop region?
 *
 * Only meaningful when the region is valid (a < b). A seek is "outside" when
 * it lands before A or at/after B — matching the half-open [a, b) the loop
 * plays.
 */
export const isSeekOutsideLoop = (
  target: number,
  a: number,
  b: number,
): boolean => a < b && (target < a || target >= b)

export interface LoopRegionPct {
  /** Left edge of the region as a percentage of the timeline (0–100). */
  left: number
  /** Width of the region as a percentage (min 0.5 so a tiny loop stays visible). */
  width: number
}

/**
 * Geometry for the loop-region overlay on the seek rail, as percentages of the
 * full timeline. Returns null when there's nothing sensible to draw (no length,
 * or an incomplete/invalid A-B). The width is floored at 0.5% for visibility,
 * and left + width is clamped to 100% so the overlay never spills past the rail.
 */
export const loopRegionPct = (
  a: number,
  b: number,
  total: number,
): LoopRegionPct | null => {
  if (total <= 0) return null
  if (!(a > 0 && b > 0 && a < b)) return null
  const left = (a / total) * 100
  const width = Math.max(0.5, ((b - a) / total) * 100)
  // Keep the overlay inside the rail even after the min-width floor bumps it.
  return { left, width: Math.min(width, 100 - left) }
}

/**
 * Clamp a candidate loop-end beat to the timeline length. The caller is
 * responsible for treating a result <= a as invalid (an empty/backwards loop).
 */
export const clampLoopB = (beat: number, _a: number, total: number): number =>
  Math.min(beat, total)
