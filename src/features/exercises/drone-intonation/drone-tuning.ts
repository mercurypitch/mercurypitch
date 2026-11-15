// ============================================================
// Drone tuning — the piano's notes, or pure intervals over the drone
// ============================================================
//
// Drone Intonation scores a sung note against a target above the drone.
// In Piano tuning the target is the piano's equal-tempered note, twelve
// equal steps to the octave as everywhere else in the app. In Pure tuning
// it is the just interval over the drone itself, a fifth at 3:2 and a
// major third at 5:4, where a voice's harmonics meet the drone's and stop
// beating against them (Lesson 24's Step 2). The two are scored on
// different rulers: a pure major third is 13.69 cents under the piano's,
// so the same note scores 100 in one and 79 in the other.

/** The Tuning picker's two chips. */
export type DroneTuning = 'piano' | 'pure'

export const DRONE_TUNING_OPTIONS: readonly {
  value: DroneTuning
  label: string
}[] = [
  { value: 'piano', label: 'Piano' },
  { value: 'pure', label: 'Pure' },
]

export const isDroneTuning = (value: unknown): value is DroneTuning =>
  value === 'piano' || value === 'pure'

/** "Piano tuning", "Pure tuning": a run's tuning, in words. */
export function tuningInWords(tuning: DroneTuning): string {
  return tuning === 'pure' ? 'Pure tuning' : 'Piano tuning'
}

/**
 * The just ratio of each interval in the drill's pool, by its semitones
 * above the drone: the smallest whole numbers whose harmonics meet.
 */
export const JUST_RATIOS: Readonly<Record<number, readonly [number, number]>> =
  {
    0: [1, 1],
    3: [6, 5],
    4: [5, 4],
    5: [4, 3],
    7: [3, 2],
    12: [2, 1],
  }

/**
 * How far the pure interval sits from the piano's, in cents: +15.64 for
 * the minor third, -13.69 for the major third, +1.96 for the fifth. Zero
 * for an interval with no just ratio here, which keeps the piano's note.
 */
export function pureOffsetCents(semitones: number): number {
  const ratio = JUST_RATIOS[semitones]
  if (ratio === undefined) return 0
  return 1200 * Math.log2(ratio[0] / ratio[1]) - 100 * semitones
}

/**
 * The note to sing over `droneMidi`, `semitones` up, in MIDI: a whole
 * number in Piano tuning, and the just interval's own pitch, a fraction
 * of a semitone off the piano's note, in Pure.
 */
export function droneTargetMidi(
  droneMidi: number,
  semitones: number,
  tuning: DroneTuning,
): number {
  const offset = tuning === 'pure' ? pureOffsetCents(semitones) / 100 : 0
  return droneMidi + semitones + offset
}

/**
 * Where a pure target sits against the piano's note, as the stage labels
 * it: "14 cents low", "2 cents high", or '' where they are the same note
 * (the unison and the octave).
 */
export function offsetInWords(cents: number): string {
  const rounded = Math.round(cents)
  if (rounded === 0) return ''
  return `${Math.abs(rounded)} cents ${rounded < 0 ? 'low' : 'high'}`
}
