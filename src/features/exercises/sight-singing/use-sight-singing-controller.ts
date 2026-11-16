// ============================================================
// Sight-Singing Controller — generate notes, advance on a correct
// sung pitch (with a timeout fallback), and score per note.
// ============================================================
//
// A note is right in any octave: a frame counts within 60 cents of the
// written note's pitch class, folded into the singer's octave, so a voice
// that reads the treble staff an octave under it (a tenor's) or sings the
// line an octave from the page is singing it (SEASON-2 § 5.2 item 10f;
// Lesson 16 FACTS 45). Until November 2026 it scored the written octave
// only, and an octave away read as a miss.

import { midiToFrequency } from '@/lib/frequency-to-note'
import { foldCents } from '@/lib/pitch-measurements'
import type { ScaleDegree } from '@/types'
import { tallyFromDeviations } from '../exercise-note-tally'
import { freqToExactMidi } from '../exercise-scoring-utils'
import type { ExerciseResult } from '../types'
import { EXERCISE_SIGHT_SINGING, stoppedEarlyMark } from '../types'
import type { BaseExerciseController } from '../use-base-exercise'
import type { SightNames } from './sight-line'

export interface SightSingingNote {
  midi: number
  name: string
  octave: number
  freq: number
  /** Index in the sequence, 0-based */
  index: number
}

/** How a note the run has passed went: held in tune, or moved on from at the limit. */
export interface SightSingingMark {
  /** Held within the band for the hold, rather than moved on from at the limit. */
  readonly held: boolean
  /** Some voice was heard on it. */
  readonly heard: boolean
  /** Its score, 0 to 100. */
  readonly score: number
}

const NOTES_PER_ROUND = 6
const POLL_MS = 80
/** How long the sung pitch must stay within tolerance to pass a note. */
const HOLD_TO_PASS_MS = 450
const TOLERANCE_CENTS = 60
/** Give up on a note after this long so the run can't hang on an unreachable one. */
const MAX_NOTE_MS = 8000

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

function noteFromMidi(midi: number, index: number): SightSingingNote {
  return {
    midi,
    name: NOTE_NAMES[((midi % 12) + 12) % 12]!,
    octave: Math.floor(midi / 12) - 1,
    freq: 440 * 2 ** ((midi - 69) / 12),
    index,
  }
}

/**
 * A walk of `count` notes on `pitchClasses` (0 C to 11 B) inside the
 * singer's range: each next note within 7 semitones of the last and never
 * the same note twice running. Random only through `random`.
 */
export function planWalk(
  pitchClasses: readonly number[],
  rangeMin: number,
  rangeMax: number,
  random: () => number = Math.random,
  count = NOTES_PER_ROUND,
): number[] {
  const pcs = [...new Set(pitchClasses.map((pc) => ((pc % 12) + 12) % 12))]
  if (pcs.length === 0) return []
  const pool: number[] = []
  for (let m = Math.ceil(rangeMin); m <= Math.floor(rangeMax); m++) {
    if (pcs.includes(((m % 12) + 12) % 12)) pool.push(m)
  }
  if (pool.length === 0) return []

  const pick = (list: readonly number[]): number =>
    list[Math.min(list.length - 1, Math.floor(random() * list.length))]!
  const notes: number[] = []
  let prev = pick(pool)
  for (let i = 0; i < count; i++) {
    const near = pool.filter((m) => m !== prev && Math.abs(m - prev) <= 7)
    const m = pick(near.length > 0 ? near : pool)
    notes.push(m)
    prev = m
  }
  return notes
}

/**
 * Final scoring, pure. The SCORE spans the whole sequence — notes never
 * sung count zero. Averaging only the attempted notes let a one-note
 * run post 70% to the weekly Legend board and outrank honest full
 * passes (owner testing: "1 of 6 notes hit - 70%"). avgAccuracy remains
 * the quality-of-what-you-sang metric the result card explains.
 */
export function finalizeSightSingingScore(
  scored: readonly number[],
  sequenceLength: number,
): { score: number; avgAccuracy: number; bestNote: number } {
  if (scored.length === 0 || sequenceLength === 0) {
    return { score: 0, avgAccuracy: 0, bestNote: 0 }
  }
  const sum = scored.reduce((a, b) => a + b, 0)
  return {
    score: Math.round(sum / sequenceLength),
    avgAccuracy: Math.round(sum / scored.length),
    bestNote: Math.max(...scored),
  }
}

export interface SightSingingOptions {
  /**
   * Whether this run is marked when stopped before its last note was graded
   * (`stoppedEarlyMark`), so it is practice: no trend, best, weak list or
   * armed challenge reads it. Read as the run ends; on by default. A weekly
   * Legend attempt turns it off: like the Legend stage, it scores an early
   * end itself, with unsung notes as 0, and that is the attempt.
   */
  marksStoppedRuns?: () => boolean
  /**
   * What the setup printed under the notes for this run, read as it ends
   * and written to the result as `names` (`NAMES_METRIC`): reading the
   * staff with no names is not the task of reading the names.
   */
  names?: () => SightNames
}

/** A run's names as a metric: 0 letters (and every run before there was a choice), 1 syllables, 2 none. */
export const NAMES_METRIC: Readonly<Record<SightNames, number>> = {
  letters: 0,
  solfege: 1,
  off: 2,
}

export function useSightSingingController(
  base: BaseExerciseController,
  options: SightSingingOptions = {},
) {
  const marksStoppedRuns = options.marksStoppedRuns ?? (() => true)
  const names = options.names ?? (() => 'letters' as const)
  let sequence: SightSingingNote[] = []
  let currentIndex = 0
  let noteStartTime = 0
  let noteStartMs: number[] = []
  // Per-note score, sparse until that note is reached.
  const noteScores: number[] = []
  // Index-aligned with noteScores. This drill judges a note by the average
  // of its BEST 30% of deviations -- it rewards finding the note after a
  // scoop -- so the tally reuses that measure rather than inventing another.
  // Notes never reached stay holes, and read as misses at tally time.
  const noteDeviations: (number | null)[] = []
  // How each passed note went, for the staff to mark.
  const noteMarks: SightSingingMark[] = []
  let holdMs = 0
  let lastPollTs = 0
  let pollTimer: ReturnType<typeof setInterval> | undefined

  base._registerDispose(() => {
    clearInterval(pollTimer)
    pollTimer = undefined
  })

  /**
   * Pick `count` scale notes that lie inside the singer's comfortable range,
   * preferring small (stepwise) moves between consecutive notes.
   */
  function generateSequence(
    scale: ScaleDegree[],
    rangeMin: number,
    rangeMax: number,
    count = NOTES_PER_ROUND,
  ): SightSingingNote[] {
    return planWalk(
      scale.map((d) => d.midi),
      rangeMin,
      rangeMax,
      Math.random,
      count,
    ).map((m, i) => noteFromMidi(m, i))
  }

  function setScale(
    scale: ScaleDegree[],
    rangeMin: number,
    rangeMax: number,
  ): void {
    sequence = generateSequence(scale, rangeMin, rangeMax)
    currentIndex = 0
    noteScores.length = 0
    noteDeviations.length = 0
    noteMarks.length = 0
    noteStartMs = []
  }

  /**
   * Sing exactly these notes, in order. The routine's apply slot launches
   * this drill with a named phrase ("then sing Ode to Joy"), and for as
   * long as only `setScale` existed the drill sang a random walk on the
   * current scale instead — the card's promise was never kept on the
   * sight-singing days.
   */
  function setNotes(midis: number[]): void {
    sequence = midis.map((midi, index) => noteFromMidi(midi, index))
    currentIndex = 0
    noteScores.length = 0
    noteDeviations.length = 0
    noteMarks.length = 0
    noteStartMs = []
  }

  function startRounds(): void {
    if (sequence.length === 0) return
    advanceToNote(0)
  }

  function advanceToNote(idx: number): void {
    clearInterval(pollTimer)
    if (idx >= sequence.length) {
      stopAndCompute()
      return
    }
    currentIndex = idx
    // The trace timeline and live tracker speak Hz - a raw MIDI number
    // here is the ~3200-cent phantom on the result card (CLAUDE-JOURNEY-005).
    base._setTargetPitch(midiToFrequency(sequence[idx]!.midi))
    noteStartTime = performance.now()
    noteStartMs[idx] = base._getElapsed()
    holdMs = 0
    lastPollTs = performance.now()
    base._updateMetrics({
      noteIndex: idx,
      totalNotes: sequence.length,
      targetMidi: sequence[idx]!.midi,
      holdPct: 0,
      detectedMidi: 0,
      centsOff: 0,
      matched: 0,
    })
    pollTimer = setInterval(pollNote, POLL_MS)
  }

  function pollNote(): void {
    if (!base._isRunning()) return
    const now = performance.now()
    const dt = now - lastPollTs
    lastPollTs = now
    const target = sequence[currentIndex]!.midi
    const p = base.currentPitch()
    let detectedMidi = 0
    let centsOff = 0
    if (p && p.freq > 0) {
      detectedMidi = freqToExactMidi(p.freq)
      centsOff = foldCents((detectedMidi - target) * 100)
      if (Math.abs(centsOff) <= TOLERANCE_CENTS) holdMs += dt
      else holdMs = Math.max(0, holdMs - dt * 0.5)
    } else {
      holdMs = Math.max(0, holdMs - dt * 0.5)
    }

    base._updateMetrics({
      detectedMidi: detectedMidi > 0 ? Math.round(detectedMidi * 10) / 10 : 0,
      centsOff: Math.round(centsOff),
      holdPct: Math.min(100, Math.round((holdMs / HOLD_TO_PASS_MS) * 100)),
    })

    if (holdMs >= HOLD_TO_PASS_MS) {
      scoreAndAdvance(true)
      return
    }
    if (now - noteStartTime >= MAX_NOTE_MS) {
      scoreAndAdvance(false)
    }
  }

  function scoreAndAdvance(matched: boolean): void {
    const idx = currentIndex
    const note = sequence[idx]!
    const startMs = noteStartMs[idx] ?? 0
    const endMs = base._getElapsed()
    const samples = base
      .pitchHistory()
      .filter(
        (p) => p.time * 1000 >= startMs && p.time * 1000 <= endMs && p.freq > 0,
      )

    let noteScore = 0
    if (samples.length >= 2) {
      const deviations = samples
        .map((p) =>
          Math.abs(foldCents((freqToExactMidi(p.freq) - note.midi) * 100)),
        )
        .sort((a, b) => a - b)
      // Best 30% of the attempt — rewards finding the note even after a scoop.
      const best = deviations.slice(
        0,
        Math.max(1, Math.floor(deviations.length * 0.3)),
      )
      const avgBest = best.reduce((a, b) => a + b, 0) / best.length
      noteDeviations[idx] = avgBest
      noteScore = Math.max(0, Math.round(100 - avgBest * 1.5))
    }
    if (matched) noteScore = Math.max(noteScore, 70)
    noteScores[idx] = noteScore
    noteMarks[idx] = {
      held: matched,
      heard: samples.length >= 2,
      score: noteScore,
    }

    const done = noteScores.filter((s) => typeof s === 'number')
    const avg =
      done.length > 0
        ? Math.round(done.reduce((a, b) => a + b, 0) / done.length)
        : 0
    base._updateScore(avg)
    base._updateMetrics({
      lastNoteScore: noteScore,
      matched: matched ? 1 : 0,
      notesCompleted: done.length,
    })

    advanceToNote(idx + 1)
  }

  function stopRounds(): void {
    clearInterval(pollTimer)
    pollTimer = undefined
    base._setRunning(false)
    base._completeWithResult(computeResult())
  }

  function stopAndCompute(): void {
    clearInterval(pollTimer)
    pollTimer = undefined
    base._setRunning(false)
    base._completeWithResult(computeResult())
  }

  function computeResult(): ExerciseResult {
    const scored = noteScores.filter((s) => typeof s === 'number')
    const final = finalizeSightSingingScore(scored, sequence.length)

    return {
      type: EXERCISE_SIGHT_SINGING,
      score: final.score,
      metrics: {
        notesAttempted: sequence.length,
        notesScored: scored.length,
        avgAccuracy: final.avgAccuracy,
        bestNote: final.bestNote,
        names: NAMES_METRIC[names()],
        // The score already counts an unsung note as 0, so a Stop cannot
        // pass a bar. Unmarked, it still pulled the trends, the best and
        // the weak list down, and spent an armed challenge's attempt.
        ...stoppedEarlyMark(
          marksStoppedRuns() && scored.length < sequence.length,
        ),
        // Over the WHOLE sequence, not just the notes that captured audio:
        // a run abandoned halfway presented every note it showed.
        ...tallyFromDeviations(
          Array.from(
            { length: sequence.length },
            (_, i) => noteDeviations[i] ?? null,
          ),
        ),
      },
      completedAt: Date.now(),
    }
  }

  return {
    setScale,
    setNotes,
    startRounds,
    stopRounds,
    stopAndCompute,
    generateSequence,
    getSequence: () => sequence,
    getCurrentIndex: () => currentIndex,
    /** How each note passed so far went, by its place in the line. */
    getMarks: (): readonly (SightSingingMark | undefined)[] => [...noteMarks],
  }
}
