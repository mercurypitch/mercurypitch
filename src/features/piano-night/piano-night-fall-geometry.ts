// ============================================================
// Piano Night fall geometry — beat-truthful note-on and note-off edges
// ============================================================
//
// The leading edge reaches the keyboard at note-on and the trailing edge
// reaches it at note-off. Travel and duration intentionally share one scale.

export const PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT = 6.4
export const PIANO_NIGHT_FALL_LOOKAHEAD_BEATS = 13

export interface PianoNightFallGeometry {
  bottomPercent: number
  heightPercent: number
  visible: boolean
  striking: boolean
}

export function pianoNightFallGeometry(
  startBeat: number,
  durationBeats: number,
  playheadBeat: number,
): PianoNightFallGeometry {
  const duration = Number.isFinite(durationBeats)
    ? Math.max(0, durationBeats)
    : 0
  const relativeBeat = startBeat - playheadBeat
  const endBeat = startBeat + duration
  const isBeforeRelease = playheadBeat < endBeat

  return {
    bottomPercent: relativeBeat * PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT,
    heightPercent: duration * PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT,
    visible:
      duration > 0 &&
      isBeforeRelease &&
      relativeBeat <= PIANO_NIGHT_FALL_LOOKAHEAD_BEATS,
    striking: duration > 0 && playheadBeat >= startBeat && isBeforeRelease,
  }
}
