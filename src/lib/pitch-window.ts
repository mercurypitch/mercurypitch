export interface PitchWindowResumeState {
  anchor: number
  windowStart: number
}

/** Reset a paused pitch window around the current transport position. */
export function getPitchWindowResumeState(
  elapsed: number,
  windowDuration: number,
  preferredAnchor: number,
): PitchWindowResumeState {
  const duration = Math.max(0, windowDuration)
  const anchor = Math.max(0, Math.min(1, preferredAnchor))
  return {
    anchor,
    windowStart: Math.max(0, elapsed - anchor * duration),
  }
}
