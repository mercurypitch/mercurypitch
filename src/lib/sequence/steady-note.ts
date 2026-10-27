// ============================================================
// Steady note — the note a voice sat on while it missed one (pure)
// ============================================================
//
// When a note of a phrase misses, Merc names what the singer sang instead
// ("You sang D4. That note was E4.") or says the note sat flat or sharp.
// This finds it: of the stretches where the voice sat still, the one
// nearest the note asked for.
//
// A stretch is steady by the test a landing passes, applied to whatever
// note the voice sat on: on one voiced run, at least the level's land time
// long (first reading to last), with the voice's smoothed centre (the hold
// engine's one-pole, the same time constant) inside a band as wide as the
// level's. So a slide is never a steady note, and a vibrato that would
// land on its own note is one. The tracker's slips go first, as the hold
// reading drops them (keptReading, hold-reading.ts).
//
// A reading a semitone or more from the centre starts it again from that
// reading. The hold's own centre never has far to go, since its readings
// are held to a semitone either side of the note; this centre follows the
// voice as sung, so after a leap of nine semitones it would take some 18
// frames to settle, and a wrong note held only Merc's 0.45 s at
// Professional would never count. A vibrato never swings that far from
// the centre, and a slide that starts it again is still moving too fast
// to be steady.
//
// The readings are the voice as sung: not held to a semitone, so a wrong
// note keeps its name, and not folded, so it keeps its octave. Only its
// distance from the note asked for is folded, at the levels that fold.
//
// First note asks the other question of the same stretches: not which was
// nearest, but which came first. The singer's entry is the first note
// their voice sat on (firstSteadyNote), found as soon as it has lasted the
// land time, so it can be judged while they are still singing it.

import type { PitchPoint } from '@/lib/hold/hold-reading'
import { keptReading, startsRun } from '@/lib/hold/hold-reading'
import { foldCents, median } from '@/lib/pitch-measurements'

export interface SteadyNote {
  /** The note the voice sat on, MIDI, in the octave it was sung. */
  readonly midi: number
  /**
   * Where it sat, cents off the note asked for: signed and not held to a
   * semitone; folded to the nearest octave at the levels that fold.
   */
  readonly cents: number
}

export interface SteadyOptions {
  /** The note asked for, MIDI; the readings are cents off it. */
  readonly targetMidi: number
  /** The level's band half-width, cents: a steady stretch spans twice it. */
  readonly tolCents: number
  /** The level's land time, ms: a steady stretch lasts at least this. */
  readonly landMs: number
  readonly octaveFold: boolean
  /**
   * The voice was already sounding when the note's window opened: the
   * opening stretch of its first run is the last note held over, not a try
   * at this one, and does not count.
   */
  readonly heldOver: boolean
  /** The smoothed centre's time constant, seconds (the hold engine's). */
  readonly centreTauSec: number
  /**
   * A gap between readings longer than this starts a new run, seconds. The
   * Mirror's voiced-run gap by default; a caller whose tracker may read
   * only a few times a second widens it, as the hold engine, which counts
   * the time between voiced readings, already reads such a voice as one.
   */
  readonly runGapSec?: number
}

/** Float sums of frame times drift; thresholds compare with this slack. */
const EPS = 1e-6

/** A reading this far from the smoothed centre starts it again, cents. */
export const RESEED_CENTS = 100

/** Voiced readings split where a gap starts a new run (startsRun, or `gapSec`). */
function voicedRuns(
  points: readonly PitchPoint[],
  gapSec?: number,
): PitchPoint[][] {
  const runs: PitchPoint[][] = []
  for (const [i, point] of points.entries()) {
    const breaks =
      i > 0 &&
      (gapSec === undefined
        ? startsRun(points[i - 1], point)
        : point.t - points[i - 1].t > gapSec + EPS)
    if (i === 0 || breaks) runs.push([])
    runs[runs.length - 1].push(point)
  }
  return runs
}

/**
 * The hold engine's one-pole centre over one run, fresh at its start and
 * again on any reading RESEED_CENTS or more from it.
 */
function smoothedCentre(run: readonly PitchPoint[], tauSec: number): number[] {
  const out: number[] = []
  let centre = 0
  for (const [i, point] of run.entries()) {
    if (i === 0 || Math.abs(point.cents - centre) >= RESEED_CENTS - EPS) {
      centre = point.cents
    } else {
      const dt = point.t - run[i - 1].t
      const alpha = tauSec > 0 ? 1 - Math.exp(-dt / tauSec) : 1
      centre += alpha * (point.cents - centre)
    }
    out.push(centre)
  }
  return out
}

/**
 * For each reading, where the longest stretch ending on it starts: the
 * earliest index from which the values up to it span at most `width`.
 * Never decreasing, since a stretch that fits still fits with its last
 * reading dropped.
 */
function stretchStarts(values: readonly number[], width: number): number[] {
  const starts: number[] = []
  for (let r = 0; r < values.length; r++) {
    let low = values[r]
    let high = values[r]
    let l = r
    while (l > 0) {
      const value = values[l - 1]
      if (Math.max(high, value) - Math.min(low, value) > width + EPS) break
      low = Math.min(low, value)
      high = Math.max(high, value)
      l -= 1
    }
    starts.push(l)
  }
  return starts
}

/** One steady stretch as a note: its median, named and measured. */
function asSteadyNote(
  stretch: readonly PitchPoint[],
  options: SteadyOptions,
): SteadyNote {
  const sung = median(stretch.map((point) => point.cents))
  return {
    midi: options.targetMidi + Math.round(sung / 100),
    cents: options.octaveFold ? foldCents(sung) : sung,
  }
}

/**
 * The steady stretches of one voiced run, each as long as it can be (no
 * reading after it fits), as notes. `skipOpening` drops the stretch that
 * starts on the run's first reading (the last note held over).
 */
function steadyNotesOfRun(
  run: readonly PitchPoint[],
  options: SteadyOptions,
  skipOpening: boolean,
): SteadyNote[] {
  const kept = run.filter((_, i) => keptReading(run, i) !== null)
  const centre = smoothedCentre(kept, options.centreTauSec)
  const starts = stretchStarts(centre, 2 * options.tolCents)
  const notes: SteadyNote[] = []
  for (let r = 0; r < kept.length; r++) {
    const l = starts[r]
    const longest = r === kept.length - 1 || starts[r + 1] > l
    const long = kept[r].t - kept[l].t >= options.landMs / 1000 - EPS
    if (longest && long && !(skipOpening && l === 0)) {
      notes.push(asSteadyNote(kept.slice(l, r + 1), options))
    }
  }
  return notes
}

/**
 * The steady note nearest the note asked for, among the voiced readings
 * of the window it was the one to sing (oldest first, cents off it as
 * sung); null when the voice never sat still. The first of equals wins.
 */
export function closestSteadyNote(
  points: readonly PitchPoint[],
  options: SteadyOptions,
): SteadyNote | null {
  let best: SteadyNote | null = null
  for (const [i, run] of voicedRuns(points, options.runGapSec).entries()) {
    for (const note of steadyNotesOfRun(
      run,
      options,
      options.heldOver && i === 0,
    )) {
      if (best === null || Math.abs(note.cents) < Math.abs(best.cents)) {
        best = note
      }
    }
  }
  return best
}

/**
 * The first steady note among the readings (oldest first, cents off the
 * note asked for as sung): the earliest stretch the voice sat still for the
 * land time, taken as soon as it has lasted that long, so a stretch still
 * being sung counts. Null until the voice has sat still that long.
 */
export function firstSteadyNote(
  points: readonly PitchPoint[],
  options: SteadyOptions,
): SteadyNote | null {
  for (const [i, run] of voicedRuns(points, options.runGapSec).entries()) {
    const notes = steadyNotesOfRun(run, options, options.heldOver && i === 0)
    if (notes.length > 0) return notes[0]
  }
  return null
}
