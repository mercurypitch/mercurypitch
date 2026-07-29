// ============================================================
// Ear Lab — the Mercury Index.
//
// One 0–1000 number over faculties measured in wildly different
// units (cents, ms, dB, notes, Elo points). Every reading passes
// through an anchored scale — novice reading → 0, expert reading →
// 1000 — so the composite rises monotonically whichever drill
// produced the input, and a cents reading that *falls* still pushes
// the column *up*.
//
// Faculties with no reading are left out rather than counted as
// zero: an untouched drill is missing data, not a bad ear, and
// scoring it as failure would punish the user for the app's own
// content gaps.
// ============================================================

import type { FacultyId, ReadingScale } from './drills'

/** Full scale of the index. The column is marked in tenths. */
export const INDEX_MAX = 1000

/** How much each faculty is worth in the composite. Function leads
 *  because in-key hearing is the skill that transfers to playing;
 *  In The Wild is weighted next because doing it on real audio is
 *  the proof the rest of it took. */
export const FACULTY_WEIGHTS: Record<FacultyId, number> = {
  function: 1.3,
  wild: 1.2,
  resolution: 1,
  shape: 1,
  colour: 1,
  time: 0.9,
}

export interface FacultyReading {
  faculty: FacultyId
  /** Raw reading in the drill's own unit, or an Elo rating. */
  value: number
  scale: ReadingScale
}

export interface MercuryIndex {
  /** 0–1000. */
  value: number
  /** The sub-score each measured faculty contributed. */
  parts: Partial<Record<FacultyId, number>>
  /** Faculties that have never been measured. While this is
   *  non-empty the column renders a dashed cap, not a solid line. */
  missing: FacultyId[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Map one raw reading onto 0–1000.
 *
 *  The sign of `expert - novice` carries the direction, so the same
 *  formula handles a threshold that improves downward (50¢ → 3¢) and
 *  a span that improves upward (3 → 9 notes). */
export function scoreReading(reading: number, scale: ReadingScale): number {
  const { novice, expert, curve } = scale
  if (novice === expert) return 0

  let t: number
  if (curve === 'log') {
    // Log space needs strictly positive readings; a zero or negative
    // one means a broken drill, not a perfect ear.
    if (reading <= 0 || novice <= 0 || expert <= 0) return 0
    t =
      (Math.log(reading) - Math.log(novice)) /
      (Math.log(expert) - Math.log(novice))
  } else {
    t = (reading - novice) / (expert - novice)
  }

  return clamp(Math.round(t * INDEX_MAX), 0, INDEX_MAX)
}

/** Composite the measured faculties, weight-normalised over what is
 *  actually present. */
export function mercuryIndex(
  readings: readonly FacultyReading[],
  weights: Record<FacultyId, number> = FACULTY_WEIGHTS,
): MercuryIndex {
  const parts: Partial<Record<FacultyId, number>> = {}
  for (const reading of readings) {
    parts[reading.faculty] = scoreReading(reading.value, reading.scale)
  }

  const measured = Object.keys(parts) as FacultyId[]
  const missing = (Object.keys(weights) as FacultyId[]).filter(
    (f) => !measured.includes(f),
  )

  if (measured.length === 0) {
    return { value: 0, parts, missing }
  }

  let weighted = 0
  let totalWeight = 0
  for (const faculty of measured) {
    const weight = weights[faculty] ?? 1
    weighted += (parts[faculty] ?? 0) * weight
    totalWeight += weight
  }

  return {
    value: Math.round(weighted / totalWeight),
    parts,
    missing,
  }
}
