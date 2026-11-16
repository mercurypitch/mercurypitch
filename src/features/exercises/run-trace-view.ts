// ============================================================
// Run-trace view maths — reading a finished run back
// ============================================================
//
// last-run-trace.ts captures every run's contour and its target timeline. This
// turns that into the three things the result card needs: where the target was
// at any instant, how far the singer strayed at their worst, and the frequency
// window that frames both. Pure, so the drawing code stays a renderer and the
// judgement below stays testable.

import { foldCents } from '@/lib/pitch-measurements'
import type { RunTrace, TracePoint } from './last-run-trace'

/** Never frame a run tighter than this, or a steady note fills the canvas. */
const MIN_SPAN_OCTAVES = 0.5
/** Breathing room above and below the extremes, in octaves. */
const PADDING_OCTAVES = 0.12
/** A target that moves this far or more at once has moved to a new note, cents; a glide's steps are smaller. */
const NEW_NOTE_CENTS = 50
/**
 * For this long after the target moves to a new note, the voice is still
 * arriving on it, seconds. A drill that keeps time moves its target on the
 * beat, and the voice reaches the note a moment before or after: the old
 * note sung there is the arrival, not a moment the singer was off.
 */
export const ARRIVAL_SEC = 0.25

export interface WorstMoment {
  /** Seconds since the run started. */
  t: number
  /** What was sung, in Hz. */
  f: number
  /** What was asked for, in Hz. */
  target: number
  /** Signed distance in cents — positive is sharp. */
  cents: number
}

export interface TraceBounds {
  /** log2 Hz at the bottom of the plot. */
  logMin: number
  /** log2 Hz at the top of the plot. */
  logMax: number
  /** Seconds on the x axis. */
  duration: number
}

/**
 * The reference tone in force at `t`.
 *
 * The timeline records one point per CHANGE, so a target holds until the next
 * one — interpolating between them would invent a glide the drill never asked
 * for. Returns null before the first target: a run whose first note has not
 * been played yet is not off-pitch, it is unjudged.
 */
export function targetAt(
  targets: readonly TracePoint[],
  t: number,
): number | null {
  let held: number | null = null
  for (const point of targets) {
    if (point.t > t) break
    held = point.f
  }
  return held
}

/** Signed cents from `target` to `f` — positive is sharp. */
export function centsBetween(f: number, target: number): number {
  return 1200 * Math.log2(f / target)
}

/**
 * The moment the run went furthest off target.
 *
 * This is the one place on the result card that says WHERE it went wrong
 * rather than by how much overall — a score of 71 tells a singer nothing they
 * can practice, and "you were 90 cents flat four seconds in" does. The voice
 * on its way to a new note, for `ARRIVAL_SEC` after the target moved there,
 * is not counted: it names the moment between two notes, not a miss. A
 * drill that hears any octave (`folded`) measures the distance in the
 * octave the voice is in.
 *
 * A drill that moves on when the singer has held a note (`selfPaced`) moves
 * its target while the voice is still on that note, and a reader stays there
 * for as long as the next note takes to read: a run sung in tune throughout
 * read "506 cents sharp of D4", the fourth between two of its notes (seen in
 * Sight-Singing, November 2026). So there the voice counts on a new note
 * from the moment it is nearer that note than the last one, however long
 * that takes, and a voice that never leaves the last note says nothing
 * here: the note's own mark says it was not sung.
 */
export function worstMoment(trace: RunTrace): WorstMoment | null {
  if (trace.targets.length === 0) return null

  const off = distanceAs(trace)
  const arrived = arrivalsOf(trace, off)
  let worst: WorstMoment | null = null
  for (const sample of trace.samples) {
    if (!Number.isFinite(sample.f) || sample.f <= 0) continue
    const target = targetAt(trace.targets, sample.t)
    if (target === null || target <= 0) continue
    const cents = off(sample.f, target)
    if (!arrived(sample, cents)) continue
    if (worst === null || Math.abs(cents) > Math.abs(worst.cents)) {
      worst = { t: sample.t, f: sample.f, target, cents }
    }
  }
  return worst
}

/** Cents from a target to a voice, as the run's drill hears it: in the
 *  octave the voice is in where it hears any octave. */
function distanceAs(trace: RunTrace): (f: number, target: number) => number {
  return trace.folded === true
    ? (f, target) => foldCents(centsBetween(f, target))
    : centsBetween
}

/**
 * Whether the voice has arrived on the note a sample falls in, asked of a
 * run's samples in the order they were heard (one out of order starts the
 * walk again). `cents` is the sample's distance from its target.
 */
function arrivalsOf(
  trace: RunTrace,
  off: (f: number, target: number) => number,
): (sample: TracePoint, cents: number) => boolean {
  const notes = newNotesOf(trace.targets)
  // The note the last sample fell in, and whether the voice has left the
  // note before it.
  let n = -1
  let left = false
  let lastT = Number.NEGATIVE_INFINITY
  return (sample, cents) => {
    if (sample.t < lastT) {
      n = -1
      left = false
    }
    lastT = sample.t
    while (n + 1 < notes.length && notes[n + 1].t <= sample.t) {
      n += 1
      left = false
    }
    if (n < 0) return true
    const note = notes[n]
    if (sample.t - note.t < ARRIVAL_SEC) return false
    if (trace.selfPaced !== true || left) return true
    const stillOnLast =
      note.last !== null && Math.abs(off(sample.f, note.last)) < Math.abs(cents)
    if (stillOnLast) return false
    left = true
    return true
  }
}

/** A note in the target's timeline: when it began, and the note before it. */
interface NoteStart {
  t: number
  /** The target just before this note, in Hz; null for the first note. */
  last: number | null
}

/** Where the target moved to a new note: its first, and each jump of `NEW_NOTE_CENTS` or more. */
function newNotesOf(targets: readonly TracePoint[]): NoteStart[] {
  const notes: NoteStart[] = []
  let held: number | null = null
  for (const point of targets) {
    if (!Number.isFinite(point.f) || point.f <= 0) continue
    if (
      held === null ||
      Math.abs(centsBetween(point.f, held)) >= NEW_NOTE_CENTS
    )
      notes.push({ t: point.t, last: held })
    held = point.f
  }
  return notes
}

/**
 * The frequency window that frames the run — both what was sung and what was
 * asked for, so a phrase the singer missed by an octave still shows the miss
 * rather than cropping the target out of the picture.
 */
export function traceBounds(trace: RunTrace): TraceBounds | null {
  const logs: number[] = []
  for (const point of [...trace.samples, ...trace.targets]) {
    if (Number.isFinite(point.f) && point.f > 0) logs.push(Math.log2(point.f))
  }
  if (logs.length === 0) return null

  let logMin = Math.min(...logs) - PADDING_OCTAVES
  let logMax = Math.max(...logs) + PADDING_OCTAVES
  const shortfall = MIN_SPAN_OCTAVES - (logMax - logMin)
  if (shortfall > 0) {
    logMin -= shortfall / 2
    logMax += shortfall / 2
  }

  // The x axis comes from the recorded duration, not the last sample: a run
  // that ended in silence still lasted as long as it lasted, and shrinking the
  // axis to the last sung note would stretch the contour to fill time that was
  // never sung.
  const duration = Math.max(trace.durationMs / 1000, 0.1)
  return { logMin, logMax, duration }
}
