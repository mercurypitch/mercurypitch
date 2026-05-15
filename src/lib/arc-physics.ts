// ============================================================
// Arc Physics — pure functions for the Yousician-style jumping ball
// ============================================================

/** Lightweight note reference used by the arc physics (no full MelodyItem needed). */
export interface PlayableNote {
  startBeat: number
  duration: number
}

export interface ArcState {
  /** Beat-space source X (mapped to pixels via beatToX at render time). */
  sx: number
  /** Pixel-space source Y (derived from note frequency). */
  sy: number
  /** Beat-space target X. */
  ex: number
  /** Pixel-space target Y. */
  ey: number
  /** Pixel-space control-point Y (below the arc for the jump effect). */
  cy: number
  startBeat: number
  endBeat: number
  noteIndex: number
  initialized: boolean
  isRest: boolean
}

export const BALL_RADIUS = 8

/**
 * Quadratic Bezier position at a given beat.
 * Returns `beatX` in beat-space (map to pixels via beatToX at render time)
 * and `y` in pixel-space. Returns the source position if degenerate.
 */
export const computeBallPos = (
  beat: number,
  s: ArcState,
): { beatX: number; y: number } => {
  if (s.startBeat < s.endBeat) {
    const t = Math.max(
      0,
      Math.min(1, (beat - s.startBeat) / (s.endBeat - s.startBeat)),
    )
    if (s.isRest) {
      const beatX = (1 - t) * s.sx + t * s.ex
      const durBeats = s.endBeat - s.startBeat
      const cycles = Math.max(1, Math.round(durBeats))
      const sineVal = Math.sin(t * Math.PI * 2 * cycles) * 40
      const y = (1 - t) * s.sy + t * s.ey + sineVal
      return { beatX, y }
    } else {
      const midX = (s.sx + s.ex) / 2
      return {
        beatX: (1 - t) * (1 - t) * s.sx + 2 * (1 - t) * t * midX + t * t * s.ex,
        y: (1 - t) * (1 - t) * s.sy + 2 * (1 - t) * t * s.cy + t * t * s.ey,
      }
    }
  }
  return { beatX: s.sx, y: s.sy }
}

/** Compute arc control-point Y based on vertical distance and BPM. */
export const computeArcCy = (
  srcY: number,
  targetY: number,
  bpm: number,
): number => {
  const vert = Math.abs(srcY - targetY)
  const bpmFactor = Math.sqrt(120 / Math.max(40, Math.min(280, bpm)))
  const height = Math.max(vert * 0.5, 60) * bpmFactor
  return Math.min(srcY, targetY) - height
}

/** Compute when the arc should end — the ball arrives at the note's end. */
export const computeArcEndBeat = (targetNote: PlayableNote): number => {
  return targetNote.startBeat + targetNote.duration
}

/** Ball begins arcing toward the next note this many beats before its start. */
const ARC_LOOK_AHEAD = 1

/**
 * Whether the arc should advance from `cur` to `next` at the given beat.
 * Waits until the playhead is within `ARC_LOOK_AHEAD` beats of the next
 * note's start so the ball doesn't drift across long gaps.
 */
export const shouldAdvanceArc = (
  _cur: PlayableNote,
  next: PlayableNote,
  beat: number,
): boolean => {
  return beat >= next.startBeat - ARC_LOOK_AHEAD
}

/**
 * Filter melody items into a playable list (excludes rests).
 * `idx` is the original melody index; items are in playback order.
 */
export const buildPlayable = <
  T extends { isRest?: boolean; startBeat: number },
>(
  melody: T[],
): { idx: number; item: T }[] => {
  const sorted = [...melody].sort((a, b) => a.startBeat - b.startBeat)
  return sorted.map((item, i) => ({ idx: i, item }))
}

/**
 * Compute initial arc: ball appears above the first note and arcs down to
 * its end position (top-right corner).  All X coordinates are beat-space;
 * callers map to pixels via beatToX.
 */
export const computeInitialArc = (
  firstNote: PlayableNote,
  startBeatX: number,
  targetY: number,
): Pick<
  ArcState,
  | 'sx'
  | 'sy'
  | 'ex'
  | 'ey'
  | 'cy'
  | 'startBeat'
  | 'endBeat'
  | 'noteIndex'
  | 'isRest'
> => {
  const aboveY = targetY - 100
  return {
    sx: startBeatX,
    sy: aboveY,
    ex: firstNote.startBeat + firstNote.duration,
    ey: targetY,
    cy: targetY - 160,
    startBeat: Math.max(0, firstNote.startBeat - 0.5),
    endBeat: firstNote.startBeat + firstNote.duration,
    noteIndex: 0,
    isRest: false,
  }
}

/**
 * Detect a backwards seek — beat moved backwards by more than `threshold` beats.
 * Returns true if state should be reset.
 */
export const isBackwardsSeek = (
  beat: number,
  prevBeat: number,
  threshold = 0.5,
): boolean => {
  return prevBeat >= 0 && beat < prevBeat - threshold
}
