// ============================================================
// Piano Night practice loop — beat-native range and pass-state helpers
// ============================================================
//
// Beat zero is a real boundary, never an unset sentinel. The controller owns
// the audio-clock transition; these helpers keep normalization, progress, and
// labels deterministic without creating another timing owner.

export const PIANO_NIGHT_MIN_LOOP_BEATS = 0.25
export const PIANO_NIGHT_DEFAULT_REPEAT_COUNT = 5
export const PIANO_NIGHT_MAX_REPEAT_COUNT = 100
export const PIANO_NIGHT_PRACTICE_SPEEDS = [0.5, 0.75, 1, 1.25] as const
export const PIANO_NIGHT_DEFAULT_MASTER_VOLUME = 0.82

export interface PianoNightPracticeRange {
  readonly startBeat: number
  readonly endBeat: number
}

export interface PianoNightPracticeLoopState {
  readonly range: PianoNightPracticeRange | null
  readonly enabled: boolean
  /** Total passes through the range. */
  readonly repeatCount: number
  /** One-based pass currently in progress. */
  readonly currentPass: number
}

export const INITIAL_PIANO_NIGHT_PRACTICE_LOOP: PianoNightPracticeLoopState =
  Object.freeze({
    range: null,
    enabled: false,
    repeatCount: PIANO_NIGHT_DEFAULT_REPEAT_COUNT,
    currentPass: 1,
  })

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizePianoNightPracticeRange(
  range: PianoNightPracticeRange,
  totalBeats: number,
): PianoNightPracticeRange | null {
  if (
    !Number.isFinite(range.startBeat) ||
    !Number.isFinite(range.endBeat) ||
    !Number.isFinite(totalBeats) ||
    totalBeats <= 0
  ) {
    return null
  }
  const startBeat = clamp(range.startBeat, 0, totalBeats)
  const endBeat = clamp(range.endBeat, 0, totalBeats)
  if (endBeat - startBeat < PIANO_NIGHT_MIN_LOOP_BEATS) return null
  return Object.freeze({ startBeat, endBeat })
}

export function clampPianoNightRepeatCount(repeatCount: number): number {
  if (!Number.isFinite(repeatCount)) return PIANO_NIGHT_DEFAULT_REPEAT_COUNT
  return clamp(Math.round(repeatCount), 2, PIANO_NIGHT_MAX_REPEAT_COUNT)
}

export function isPianoNightPracticeSpeed(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    PIANO_NIGHT_PRACTICE_SPEEDS.some((speed) => speed === value)
  )
}

export function clampPianoNightMasterVolume(volume: number): number {
  if (!Number.isFinite(volume)) return PIANO_NIGHT_DEFAULT_MASTER_VOLUME
  return clamp(volume, 0, 1)
}

export function isBeatInPianoNightPracticeRange(
  beat: number,
  range: PianoNightPracticeRange,
): boolean {
  return beat >= range.startBeat && beat < range.endBeat
}

export function pianoNightPracticeRangeProgress(
  playheadBeat: number,
  range: PianoNightPracticeRange | null,
): number {
  if (range === null) return 0
  const duration = range.endBeat - range.startBeat
  if (!(duration > 0)) return 0
  return clamp((playheadBeat - range.startBeat) / duration, 0, 1)
}
