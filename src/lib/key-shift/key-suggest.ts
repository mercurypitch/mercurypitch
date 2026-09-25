// ============================================================
// Key suggest — the key shift that fits a melody to a singer
// ============================================================
//
// "Find my key". Every candidate backing shift k in −6..+6 is tried with the
// singer on the written octave or one octave either side, and each is scored
// by how uncomfortable the melody would be to sing, weighted by how long
// each note is held:
//
//   - inside the comfortable band (the range minus a margin): free;
//   - inside the range but outside the band: 0.5 per semitone past the band;
//   - outside the range: 2 per semitone past the range, plus the margin.
//
// Two small preferences break near-ties the way a singer would: stay on the
// written octave (an octave jump costs OCTAVE_PENALTY), and stay inside the
// clean ±4 (each semitone beyond costs STRETCH_PENALTY). Exact ties go to the
// smallest |k|, then the written octave.

import { KEY_SHIFT_CLEAN_LIMIT, KEY_SHIFT_MAX, KEY_SHIFT_MIN, } from './key-shift'

export interface SingerRange {
  lowMidi: number
  highMidi: number
}

export interface TimedNote {
  midi: number
  startTime: number
  endTime: number
}

export interface KeySuggestion {
  keyShift: number
  /** Where the singer sings relative to the written melody. */
  octave: -12 | 0 | 12
  /** Share of sung time, 0..1, inside the singer's full range. */
  inRange: number
}

const OCTAVES = [0, -12, 12] as const
const OCTAVE_PENALTY = 0.3
const STRETCH_PENALTY = 0.3
const TIE_EPSILON = 0.01
const MIN_RANGE_SPAN = 3

interface WeightedNote {
  midi: number
  weight: number
}

interface Candidate {
  cost: number
  keyShift: number
  octave: (typeof OCTAVES)[number]
}

function noteCost(midi: number, range: SingerRange, margin: number): number {
  const bandLow = range.lowMidi + margin
  const bandHigh = range.highMidi - margin
  if (midi >= bandLow && midi <= bandHigh) return 0
  if (midi >= range.lowMidi && midi <= range.highMidi)
    return 0.5 * (midi < bandLow ? bandLow - midi : midi - bandHigh)
  const outside =
    midi < range.lowMidi ? range.lowMidi - midi : midi - range.highMidi
  return 2 * (outside + margin)
}

function isBetter(
  cost: number,
  keyShift: number,
  octave: number,
  best: Candidate | null,
): boolean {
  if (best === null || cost < best.cost - TIE_EPSILON) return true
  if (cost > best.cost + TIE_EPSILON) return false
  if (Math.abs(keyShift) !== Math.abs(best.keyShift))
    return Math.abs(keyShift) < Math.abs(best.keyShift)
  return Math.abs(octave) < Math.abs(best.octave)
}

function weighNotes(notes: readonly TimedNote[]): {
  weighted: WeightedNote[]
  totalWeight: number
} {
  const weighted: WeightedNote[] = []
  let totalWeight = 0
  for (const note of notes) {
    const weight = note.endTime - note.startTime
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(note.midi))
      continue
    weighted.push({ midi: note.midi, weight })
    totalWeight += weight
  }
  return { weighted, totalWeight }
}

function candidateCost(
  weighted: readonly WeightedNote[],
  totalWeight: number,
  keyShift: number,
  octave: number,
  range: SingerRange,
  margin: number,
): number {
  let sum = 0
  for (const note of weighted)
    sum += note.weight * noteCost(note.midi + keyShift + octave, range, margin)
  const stretch = Math.max(0, Math.abs(keyShift) - KEY_SHIFT_CLEAN_LIMIT)
  return (
    sum / totalWeight +
    (octave === 0 ? 0 : OCTAVE_PENALTY) +
    stretch * STRETCH_PENALTY
  )
}

function shareInRange(
  weighted: readonly WeightedNote[],
  totalWeight: number,
  shift: number,
  range: SingerRange,
): number {
  let inside = 0
  for (const note of weighted) {
    const sung = note.midi + shift
    if (sung >= range.lowMidi && sung <= range.highMidi) inside += note.weight
  }
  return inside / totalWeight
}

export function suggestKeyShift(
  notes: readonly TimedNote[],
  range: SingerRange,
): KeySuggestion | null {
  const span = range.highMidi - range.lowMidi
  if (!Number.isFinite(span) || span < MIN_RANGE_SPAN) return null
  const { weighted, totalWeight } = weighNotes(notes)
  if (totalWeight === 0) return null

  const margin = Math.min(2, span / 6)
  let best: Candidate | null = null
  for (let keyShift = KEY_SHIFT_MIN; keyShift <= KEY_SHIFT_MAX; keyShift++) {
    for (const octave of OCTAVES) {
      const cost = candidateCost(
        weighted,
        totalWeight,
        keyShift,
        octave,
        range,
        margin,
      )
      if (isBetter(cost, keyShift, octave, best))
        best = { cost, keyShift, octave }
    }
  }
  if (best === null) return null
  return {
    keyShift: best.keyShift,
    octave: best.octave,
    inRange: shareInRange(
      weighted,
      totalWeight,
      best.keyShift + best.octave,
      range,
    ),
  }
}
