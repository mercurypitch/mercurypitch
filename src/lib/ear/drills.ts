// ============================================================
// Ear Lab — the drill catalogue (data, not code).
//
// Two kinds of drill, one per ruler. Threshold drills produce a
// difference limen in a physical unit and are run by the staircase;
// identification drills produce an Elo rating against the item bank.
// Everything the Mercury Index needs to turn either into a 0–1000
// sub-score lives here, so the scales are auditable in one place.
// ============================================================

import type { StaircaseConfig } from './staircase'
import { DEFAULT_STAIRCASE } from './staircase'

export type FacultyId =
  | 'resolution'
  | 'function'
  | 'shape'
  | 'colour'
  | 'time'
  | 'wild'

export const FACULTY_LABEL: Record<FacultyId, string> = {
  resolution: 'Resolution',
  function: 'Function',
  shape: 'Shape',
  colour: 'Colour',
  time: 'Time',
  wild: 'In The Wild',
}

/** How a raw reading maps onto the 0–1000 Mercury scale. `novice` is
 *  the 0 end and `expert` the 1000 end, so the pair also encodes the
 *  direction of improvement — 50¢→3¢ falls, 3→9 notes rises. */
export interface ReadingScale {
  novice: number
  expert: number
  /** Ratio-scaled readings (cents, ms) interpolate in log space;
   *  counts and Elo points interpolate linearly. */
  curve: 'log' | 'linear'
}

export interface ThresholdDrill {
  id: string
  faculty: FacultyId
  name: string
  /** Rendered next to the number: "9 cents", "18 ms". */
  unit: string
  /** Short unit for tight spaces — the column, the certificate. */
  unitShort: string
  staircase: StaircaseConfig
  scale: ReadingScale
}

export interface IdentificationDrill {
  id: string
  faculty: FacultyId
  name: string
  /** Answer options on screen. Sets the Elo guess floor, so it must
   *  match what the UI actually renders. */
  choices: number
  scale: ReadingScale
}

function staircase(overrides: Partial<StaircaseConfig>): StaircaseConfig {
  return { ...DEFAULT_STAIRCASE, ...overrides }
}

/** Elo readings share one scale: 800 is a first session, 2000 is a
 *  working musician who names it before the chord finishes. */
const ELO_SCALE: ReadingScale = { novice: 800, expert: 2000, curve: 'linear' }

export const THRESHOLD_DRILLS: ThresholdDrill[] = [
  {
    id: 'hairline',
    faculty: 'resolution',
    name: 'Hairline',
    unit: 'cents',
    unitShort: '¢',
    staircase: staircase({ start: 50, min: 0.5, max: 200 }),
    scale: { novice: 40, expert: 3, curve: 'log' },
  },
  {
    id: 'beat-hunt',
    faculty: 'resolution',
    name: 'Beat Hunt',
    unit: 'cents detune',
    unitShort: '¢',
    staircase: staircase({ start: 40, min: 0.5, max: 100 }),
    scale: { novice: 30, expert: 4, curve: 'log' },
  },
  {
    id: 'the-grid',
    faculty: 'time',
    name: 'The Grid',
    unit: 'milliseconds',
    unitShort: 'ms',
    staircase: staircase({ start: 80, min: 2, max: 300 }),
    scale: { novice: 55, expert: 10, curve: 'log' },
  },
  {
    id: 'drift',
    faculty: 'time',
    name: 'Drift',
    unit: '% tempo',
    unitShort: '%',
    staircase: staircase({ start: 10, min: 0.3, max: 40 }),
    scale: { novice: 7, expert: 1.2, curve: 'log' },
  },
  {
    id: 'colour',
    faculty: 'colour',
    name: 'Colour',
    unit: 'dB boost',
    unitShort: 'dB',
    staircase: staircase({ start: 12, min: 0.5, max: 24 }),
    scale: { novice: 10, expert: 2, curve: 'log' },
  },
  {
    id: 'span',
    faculty: 'shape',
    name: 'Span',
    unit: 'notes held',
    unitShort: 'notes',
    staircase: staircase({
      start: 3,
      min: 2,
      max: 16,
      harderIs: 'higher',
      stepMode: 'linear',
      // A melody is a whole number of notes either way, so both
      // steps are 1 and the fine/coarse split does no work here.
      coarseStep: 1,
      fineStep: 1,
      narrowAfterReversals: 0,
    }),
    scale: { novice: 3, expert: 9, curve: 'linear' },
  },
]

export const IDENTIFICATION_DRILLS: IdentificationDrill[] = [
  // Faculty II — the spine. In-key, functional, cadence-primed.
  {
    id: 'home',
    faculty: 'function',
    name: 'Home',
    choices: 7,
    scale: ELO_SCALE,
  },
  {
    id: 'gravity',
    faculty: 'function',
    name: 'Gravity',
    choices: 12,
    scale: ELO_SCALE,
  },
  {
    id: 'the-pull',
    faculty: 'function',
    name: 'The Pull',
    choices: 2,
    scale: ELO_SCALE,
  },
  // Faculty III — melody and contour.
  {
    id: 'echo',
    faculty: 'shape',
    name: 'Echo',
    // Answered by playing the phrase back, not by picking — there is
    // no menu to guess from.
    choices: 0,
    scale: ELO_SCALE,
  },
  {
    id: 'contour',
    faculty: 'shape',
    name: 'Contour',
    choices: 3,
    scale: ELO_SCALE,
  },
  {
    id: 'leap',
    faculty: 'shape',
    name: 'Leap',
    choices: 12,
    scale: ELO_SCALE,
  },
  // Faculty IV — harmony.
  {
    id: 'stack',
    faculty: 'colour',
    name: 'Stack',
    choices: 6,
    scale: ELO_SCALE,
  },
  {
    id: 'cadence',
    faculty: 'colour',
    name: 'Cadence',
    choices: 4,
    scale: ELO_SCALE,
  },
  {
    id: 'bassline',
    faculty: 'colour',
    name: 'Bassline',
    choices: 7,
    scale: ELO_SCALE,
  },
  // Faculty V — time.
  {
    id: 'pulse',
    faculty: 'time',
    name: 'Pulse',
    choices: 0,
    scale: ELO_SCALE,
  },
  {
    id: 'subdivide',
    faculty: 'time',
    name: 'Subdivide',
    choices: 4,
    scale: ELO_SCALE,
  },
]

/** The Elo guess floor for a drill: 1/choices, or zero when the
 *  answer is played back rather than picked off a menu. */
export function guessRate(drill: IdentificationDrill): number {
  return drill.choices > 0 ? 1 / drill.choices : 0
}

export function findThresholdDrill(id: string): ThresholdDrill | undefined {
  return THRESHOLD_DRILLS.find((d) => d.id === id)
}

export function findIdentificationDrill(
  id: string,
): IdentificationDrill | undefined {
  return IDENTIFICATION_DRILLS.find((d) => d.id === id)
}
