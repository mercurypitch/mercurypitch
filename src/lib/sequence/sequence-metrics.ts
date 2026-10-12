// ============================================================
// Sequence metrics — an echo's result: notes on pitch, accuracy, leanings
// ============================================================
//
// Everything comes from the engine's outcomes, so the result agrees with
// the stars the room lit: "17 of 20" counts the landed notes.
//
// Accuracy is how centred the landed notes were: 100 less 1.5 points for
// each cent of their mean distance from the note, the web Call & response's
// slope (BASE_SCORE_CENTS_K in use-call-response-controller.ts; there an
// adaptive difficulty factor divides it, here the level's band does that
// job). Missed notes have no cents to give; they count in the landed number.
//
// The tendencies are signed, for Merc's one line about the run: the notes
// reached by a leap up (a minor third or more), by a step down (a semitone
// or a tone), and each phrase's last note.
//
// Rhythm, at the levels that judge it, is scored apart. Merc's onsets are
// laid over the singer's, shifted as a whole by the median gap between the
// two, so the singer's own start and one late note do not move the grid;
// each landed onset within the tolerance of its place is in time, and a
// missed note is not.

import { median } from '@/lib/pitch-measurements'
import type { NoteOutcome, Phrase } from './sequence-engine'

/** Accuracy points lost per cent of mean distance from the note. */
export const ACCURACY_CENTS_SLOPE = 1.5

/** An interval up of at least this many semitones is a leap. */
export const LEAP_SEMITONES = 3

/** One phrase sung back: the phrase, and the engine's outcomes for it. */
export interface PhraseTake {
  readonly phrase: Phrase
  readonly outcomes: readonly NoteOutcome[]
}

export interface Tendency {
  /** Notes of this kind the phrases asked for. */
  readonly notes: number
  /** Of them, landed. */
  readonly landed: number
  /** The landed ones' mean cents off the note, signed; null if none. */
  readonly meanCents: number | null
}

export interface SequenceTendencies {
  readonly leapsUp: Tendency
  readonly stepsDown: Tendency
  readonly lastNotes: Tendency
}

export interface RhythmScore {
  /** Landed notes whose onset fell within the tolerance of its place. */
  readonly inTime: number
  /** Every note asked for: "In time 4 of 5". */
  readonly notes: number
}

export interface SequenceMetrics {
  readonly notes: number
  readonly landed: number
  readonly missed: number
  /** 0 to 100; null when nothing landed, where no number is honest. */
  readonly accuracy: number | null
  readonly tendencies: SequenceTendencies
  /** Null at a level that does not judge rhythm. */
  readonly rhythm: RhythmScore | null
}

/** 100 less ACCURACY_CENTS_SLOPE a cent of mean distance; null if empty. */
export function accuracyFromCents(cents: readonly number[]): number | null {
  if (cents.length === 0) return null
  const mean = cents.reduce((sum, c) => sum + Math.abs(c), 0) / cents.length
  return Math.round(Math.max(0, 100 - ACCURACY_CENTS_SLOPE * mean))
}

/** The landed outcome for note `index`, if it landed. */
function landedCents(
  outcomes: readonly NoteOutcome[],
  index: number,
): number | null {
  const outcome = outcomes.find((o) => o.index === index)
  return outcome?.landed === true ? outcome.cents : null
}

type Kind = keyof SequenceTendencies

/** The tendencies a note belongs to, by how it is reached and where. */
function kindsOf(phrase: Phrase, index: number): Kind[] {
  const kinds: Kind[] = []
  const notes = phrase.notes
  const step = index > 0 ? notes[index].midi - notes[index - 1].midi : 0
  if (step >= LEAP_SEMITONES) kinds.push('leapsUp')
  if (step === -1 || step === -2) kinds.push('stepsDown')
  if (index === notes.length - 1) kinds.push('lastNotes')
  return kinds
}

function tendencyOf(cents: readonly (number | null)[]): Tendency {
  const landed = cents.filter((c): c is number => c !== null)
  return {
    notes: cents.length,
    landed: landed.length,
    meanCents:
      landed.length === 0
        ? null
        : landed.reduce((sum, c) => sum + c, 0) / landed.length,
  }
}

function tendencies(takes: readonly PhraseTake[]): SequenceTendencies {
  const sorted: Record<Kind, (number | null)[]> = {
    leapsUp: [],
    stepsDown: [],
    lastNotes: [],
  }
  for (const take of takes) {
    for (const index of take.phrase.notes.keys()) {
      for (const kind of kindsOf(take.phrase, index)) {
        sorted[kind].push(landedCents(take.outcomes, index))
      }
    }
  }
  return {
    leapsUp: tendencyOf(sorted.leapsUp),
    stepsDown: tendencyOf(sorted.stepsDown),
    lastNotes: tendencyOf(sorted.lastNotes),
  }
}

/** One phrase's rhythm: each landed onset against Merc's, see the header. */
export function phraseRhythm(
  take: PhraseTake,
  toleranceMs: number,
): RhythmScore {
  const gaps: number[] = []
  for (const outcome of take.outcomes) {
    if (outcome.landed) {
      gaps.push(outcome.onset - take.phrase.notes[outcome.index].at)
    }
  }
  const shift = gaps.length === 0 ? 0 : median(gaps)
  const inTime = gaps.filter(
    (gap) => Math.abs(gap - shift) * 1000 <= toleranceMs + 1e-6,
  ).length
  return { inTime, notes: take.phrase.notes.length }
}

/**
 * The result of one or more phrases (a run is five). `rhythmToleranceMs`
 * is the level's (ECHO_LEVELS); null where rhythm is not judged.
 */
export function sequenceMetrics(
  takes: readonly PhraseTake[],
  rhythmToleranceMs: number | null,
): SequenceMetrics {
  const cents: number[] = []
  let notes = 0
  for (const take of takes) {
    notes += take.phrase.notes.length
    for (const outcome of take.outcomes) {
      if (outcome.landed) cents.push(outcome.cents)
    }
  }
  let rhythm: RhythmScore | null = null
  if (rhythmToleranceMs !== null) {
    rhythm = { inTime: 0, notes }
    for (const take of takes) {
      const score = phraseRhythm(take, rhythmToleranceMs)
      rhythm = { inTime: rhythm.inTime + score.inTime, notes }
    }
  }
  return {
    notes,
    landed: cents.length,
    missed: notes - cents.length,
    accuracy: accuracyFromCents(cents),
    tendencies: tendencies(takes),
    rhythm,
  }
}
