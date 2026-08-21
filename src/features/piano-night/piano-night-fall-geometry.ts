// ============================================================
// Piano Night fall geometry — beat-truthful note-on and note-off edges
// ============================================================
//
// The leading edge reaches the keyboard at note-on and the trailing edge
// reaches it at note-off. Travel and duration intentionally share one scale.
//
// The fall is the lesson, not decoration: a note's descent IS how the stage
// says when to play it. So no motion mode ever freezes the track -- the
// quiet mode advances it in whole anchor blocks instead of pixel by pixel.

export const PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT = 6.4
export const PIANO_NIGHT_FALL_LOOKAHEAD_BEATS = 13
export const PIANO_NIGHT_FALL_ANCHOR_BEATS = 4
export const PIANO_NIGHT_FALL_OVERSCAN_BEATS = 1

export interface PianoNightFallGeometry {
  bottomPercent: number
  heightPercent: number
  visible: boolean
  striking: boolean
}

export function pianoNightFallAnchorBeat(visualBeat: number): number {
  const beat = Number.isFinite(visualBeat) ? Math.max(0, visualBeat) : 0
  return (
    Math.floor(beat / PIANO_NIGHT_FALL_ANCHOR_BEATS) *
    PIANO_NIGHT_FALL_ANCHOR_BEATS
  )
}

/**
 * How the stage advances. `flowing` scrolls the track every frame; `stepped`
 * jumps a whole anchor block at a time, so the board still tells the truth
 * about where the music is without a continuously moving surface.
 */
export type PianoNightStageMotion = 'flowing' | 'stepped'

export function isPianoNightStageMotion(
  value: unknown,
): value is PianoNightStageMotion {
  return value === 'flowing' || value === 'stepped'
}

/**
 * The beat the fall stage should draw itself at.
 *
 * `stepped` quantises to the anchor grid, which makes the track translation
 * exactly zero and re-lays the notes one block lower each time the anchor
 * moves. It must never return a beat that stops advancing: pinning the
 * visual to a phrase start froze the whole board while audio kept playing,
 * which read as "Piano Night is broken" rather than as a motion preference.
 */
export function pianoNightFallVisualBeat(
  playheadBeat: number,
  motion: PianoNightStageMotion,
): number {
  const beat = Number.isFinite(playheadBeat) ? Math.max(0, playheadBeat) : 0
  return motion === 'stepped' ? pianoNightFallAnchorBeat(beat) : beat
}

export function pianoNightFallTrackTranslationPercent(
  visualBeat: number,
  anchorBeat: number,
): number {
  return (visualBeat - anchorBeat) * PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT
}

export function pianoNightFallStaticBottomPercent(
  startBeat: number,
  anchorBeat: number,
): number {
  return (startBeat - anchorBeat) * PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT
}

export function pianoNightFallWindow<
  T extends {
    startBeat: number
    duration: number
  },
>(notes: readonly T[], anchorBeat: number): readonly T[] {
  const lowerBound = anchorBeat - PIANO_NIGHT_FALL_OVERSCAN_BEATS
  const upperBound =
    anchorBeat +
    PIANO_NIGHT_FALL_ANCHOR_BEATS +
    PIANO_NIGHT_FALL_LOOKAHEAD_BEATS

  return notes.filter(
    (note) =>
      note.startBeat <= upperBound &&
      note.startBeat + note.duration > lowerBound,
  )
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
