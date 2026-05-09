// ============================================================
// Arc Physics — pure functions for the Yousician-style jumping ball
// ============================================================

/** Lightweight note reference used by the arc physics (no full MelodyItem needed). */
export interface PlayableNote {
  startBeat: number
  duration: number
}

export interface ArcState {
  sx: number
  sy: number
  ex: number
  ey: number
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
 * Returns the source position if `startBeat >= endBeat` (degenerate arc).
 */
export const computeBallPos = (
  beat: number,
  s: ArcState,
): { x: number; y: number } => {
  if (s.startBeat < s.endBeat) {
    const t = Math.max(
      0,
      Math.min(1, (beat - s.startBeat) / (s.endBeat - s.startBeat)),
    )
    if (s.isRest) {
      const x = (1 - t) * s.sx + t * s.ex
      // Sine wave effect: completes some cycles over the duration
      // The duration in beats determines how many cycles to make it look nice
      const beats = s.endBeat - s.startBeat
      const cycles = Math.max(1, Math.round(beats))
      const sineVal = Math.sin(t * Math.PI * 2 * cycles) * 40
      const y = (1 - t) * s.sy + t * s.ey + sineVal
      return { x, y }
    } else {
      const midX = (s.sx + s.ex) / 2
      return {
        x: (1 - t) * (1 - t) * s.sx + 2 * (1 - t) * t * midX + t * t * s.ex,
        y: (1 - t) * (1 - t) * s.sy + 2 * (1 - t) * t * s.cy + t * t * s.ey,
      }
    }
  }
  return { x: s.sx, y: s.sy }
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

/** Compute when the arc should end (beat value). */
export const computeArcEndBeat = (targetNote: PlayableNote): number => {
  return targetNote.startBeat + targetNote.duration
}

/**
 * Whether the arc should advance from `cur` to `next` at the given beat.
 * Returns true when the playhead has passed the current note's end OR
 * has entered the next note's range.
 */
export const shouldAdvanceArc = (
  cur: PlayableNote,
  next: PlayableNote,
  beat: number,
): boolean => {
  return (
    beat >= next.startBeat ||
    (beat >= cur.startBeat + cur.duration &&
      beat < next.startBeat + next.duration)
  )
}

/**
 * Filter melody items into a playable list (excludes rests).
 * `idx` is the original melody index; items are in playback order.
 */
export const buildPlayable = <T extends { isRest?: boolean }>(
  melody: T[],
): { idx: number; item: T }[] => {
  const out: { idx: number; item: T }[] = []
  for (let i = 0; i < melody.length; i++) {
    out.push({ idx: i, item: melody[i] })
  }
  return out
}

/**
 * Compute initial arc: ball appears above the first note and arcs down to
 * its top-right corner.
 */
export const computeInitialArc = (
  firstNote: PlayableNote,
  startX: number,
  targetX: number,
  targetY: number,
): Pick<
  ArcState,
  'sx' | 'sy' | 'ex' | 'ey' | 'cy' | 'startBeat' | 'endBeat' | 'noteIndex'
> => {
  const aboveY = targetY - 100
  return {
    sx: startX,
    sy: aboveY,
    ex: targetX,
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
