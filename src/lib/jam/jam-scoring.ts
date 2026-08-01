// ── Jam run scoring ──────────────────────────────────────────────────
// The score a jam run is worth, computed the way the solo exercises
// compute theirs -- so 78 in a room and 78 alone mean the same thing.
//
// The room's live scoreboard (JamExerciseCanvas) stays as it is: a rolling
// "within 50 cents / not" hit rate that updates every frame. That is a good
// HUD and a bad record. It is binary, it re-counts the same samples every
// frame, and it only ever sees the last 30 seconds of history.
//
// This runs once when the run ends, over the whole take, using
// scoreNoteInRange from the shared exercise scoring utils -- the aligned
// variant, so each target note is judged only against the samples that
// landed in ITS slot. Singing all the right notes in the wrong order does
// not score.
//
// Everything here works in BEATS, not milliseconds. Beats are the only
// coordinate every peer in the room agrees on (see JamPitchMessage.beat);
// wall-clock timestamps come off the sender's Date.now() and comparing them
// across machines measures clock skew rather than musical time.

import { scoreNoteInRange } from '@/features/exercises/exercise-scoring-utils'
import type { TimeStampedPitchSample } from '@/lib/jam/types'
import type { MelodyData } from '@/types'

export interface JamNoteScore {
  /** Index into melody.items. */
  index: number
  midi: number
  startBeat: number
  endBeat: number
  /** 0-100, and 0 when nothing was sung in this note's slot. */
  score: number
  /** Whether any voiced sample landed in the slot at all. */
  voiced: boolean
}

export interface JamRunScore {
  /** 0-100, the mean across every target note. */
  score: number
  /** Fraction of target notes that got any voiced sample (0-1). */
  coverage: number
  notes: JamNoteScore[]
}

const EMPTY: JamRunScore = { score: 0, coverage: 0, notes: [] }

/**
 * Score one peer's take against the room's target melody.
 *
 * Notes with no samples score 0 rather than being dropped, so the mean is
 * coverage-aware by construction: singing four notes of a twelve-note run
 * beautifully scores the run, not the four notes. This is the same
 * correction the sight-singing exercise needed -- a partial run must score
 * its coverage, not its cherry-picked average.
 *
 * Samples without a `beat` are ignored: they were captured while nothing
 * was playing, or came from a peer old enough not to send one, and there is
 * no honest way to place them on the grid.
 */
export function scoreJamRun(
  melody: MelodyData | null,
  samples: readonly TimeStampedPitchSample[] | undefined,
  /**
   * Local receive time the current take started at. Beats repeat every take
   * -- a looped run walks the same 0..N range again -- so without this the
   * previous take's samples sit in the new take's slots and score it.
   * `timestamp` is stamped by THIS device on capture or receipt, so it is
   * comparable here even though it is not comparable across machines.
   */
  sinceTimestamp = 0,
): JamRunScore {
  if (melody === null || melody.items.length === 0) return EMPTY

  // scoreNoteInRange filters on a numeric `time` field over a [start, end)
  // range. It does not care what the unit is, so feeding it beats gives the
  // aligned per-note scoring in the room's shared coordinate.
  const onGrid = (samples ?? [])
    .filter(
      (s) =>
        s.beat !== undefined &&
        s.frequency > 0 &&
        s.timestamp >= sinceTimestamp,
    )
    .map((s) => ({ freq: s.frequency, time: s.beat!, cents: s.cents }))

  const notes = melody.items.map((item, index) => {
    const startBeat = item.startBeat
    const endBeat = item.startBeat + item.duration
    const voiced = onGrid.some((s) => s.time >= startBeat && s.time < endBeat)
    return {
      index,
      midi: item.note.midi,
      startBeat,
      endBeat,
      score: voiced
        ? scoreNoteInRange(onGrid, item.note.midi, startBeat, endBeat)
        : 0,
      voiced,
    }
  })

  const total = notes.reduce((sum, n) => sum + n.score, 0)
  const voicedCount = notes.filter((n) => n.voiced).length
  return {
    score: Math.round(total / notes.length),
    coverage: voicedCount / notes.length,
    notes,
  }
}

/**
 * My own run score, and only ever my own.
 *
 * The jam DataChannel is an unauthenticated relay -- the signaling Durable
 * Object forwards whatever a peer sends without inspecting it, and peers
 * talk to each other directly after that. So a peer's pitch stream is
 * untrusted input: fine for drawing their trail and their line on the
 * scoreboard, never a thing to persist as an achievement.
 *
 * Anything that will eventually reach exercise history, a badge, a streak
 * or a leaderboard has to come through here, computed locally from samples
 * this device captured itself.
 */
export function scoreOwnJamRun(
  melody: MelodyData | null,
  history: Record<string, TimeStampedPitchSample[]>,
  myPeerId: string | null,
  sinceTimestamp = 0,
): JamRunScore {
  if (myPeerId === null || myPeerId === '') return EMPTY
  return scoreJamRun(melody, history[myPeerId], sinceTimestamp)
}
