// ============================================================
// An Echo run: what Merc says about it, and what it keeps
// ============================================================
//
// Out of the controller: the one line about a finished phrase, the one
// line over the run's result, the result as the room shows it (a run's
// and the demo's alike), and what a run leaves behind (the exercise
// history, the best at its level and the root it started on).
//
// A phrase with a miss gets one line about its most useful miss, never a
// list (DESIGN-echo.md 5): a note held near it but flat or sharp beats a
// note held somewhere else, which beats a voice that moved on before it
// landed, which beats no voice at all. A note the echo ended on (the voice
// stopped before it) counts as no voice: the voice it heard was the note
// before it, still sounding.

import { EXERCISE_ECHO_STARS } from '@/lib/domain/exercise-contracts'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { EchoLevelId, MissedNote } from '@/lib/sequence/sequence-engine'
import type { PhraseTake, SequenceMetrics, } from '@/lib/sequence/sequence-metrics'
import { recordEchoBest, rememberEchoRoot } from '@/stores/echo-store'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { exerciseLevelName } from '@/stores/exercise-level'
import { echoScene } from './echo-scene'
import type { EchoMoment, LineFields } from './merc-lines'
import { nthNote } from './merc-lines'
import type { SkyScene } from './sky-scene'

/** A steady note this near the one asked for was a try at it, cents. */
const NEAR_CENTS = 100

/** A tendency worth a line: the landed notes' mean this far off, cents. */
const TENDENCY_CENTS = 15
/** And on at least this many landed notes of the kind. */
const TENDENCY_NOTES = 2
/** The phrases' last notes landing this much less often than the rest. */
const ENDS_SHARE_GAP = 0.25

export interface EchoLine {
  readonly moment: EchoMoment
  readonly fields: LineFields
}

/** A miss, ranked: the lower, the more use its line is. */
function missRank(miss: MissedNote, tolCents: number): number {
  if (miss.closest !== null) {
    const off = Math.abs(miss.closest.cents)
    if (off >= tolCents && off < NEAR_CENTS) return 0
    return off >= NEAR_CENTS ? 1 : 2
  }
  return miss.voiced && miss.cause !== 'silence' ? 2 : 3
}

/** Merc's line about a finished phrase at a level of `tolCents`. */
export function phraseLine(take: PhraseTake, tolCents: number): EchoLine {
  const count = take.phrase.notes.length
  const misses = take.outcomes.filter(
    (outcome): outcome is MissedNote => !outcome.landed,
  )
  const landed = count - misses.length
  if (misses.length === 0) return { moment: 'phraseAll', fields: { count } }
  if (landed === 0 && misses.every((miss) => !miss.voiced)) {
    return { moment: 'silent', fields: {} }
  }
  const best = [...misses].sort(
    (a, b) =>
      missRank(a, tolCents) - missRank(b, tolCents) || a.index - b.index,
  )[0]
  const rank = missRank(best, tolCents)
  const closest = best.closest
  if (rank === 0 && closest !== null) {
    return {
      moment: closest.cents < 0 ? 'flatNote' : 'sharpNote',
      fields: { nth: nthNote(best.index) },
    }
  }
  if (rank === 1 && closest !== null) {
    const target = take.phrase.notes[best.index]?.midi ?? closest.midi
    return {
      moment: 'otherNote',
      fields: {
        sung: midiToNoteNameOctave(closest.midi),
        target: midiToNoteNameOctave(target),
      },
    }
  }
  if (rank === 2) return { moment: 'slid', fields: {} }
  return { moment: 'phraseSome', fields: { landed, count } }
}

/**
 * Merc's line over the result: every note, else a new best, else the
 * clearest tendency, else the count.
 */
export function resultLine(
  metrics: SequenceMetrics,
  improved: boolean,
  levelName: string,
): EchoLine {
  const counts = { landed: metrics.landed, total: metrics.notes }
  if (metrics.notes > 0 && metrics.landed === metrics.notes) {
    return { moment: 'resultAll', fields: counts }
  }
  if (improved) {
    return { moment: 'newBest', fields: { ...counts, level: levelName } }
  }
  const { leapsUp, stepsDown, lastNotes } = metrics.tendencies
  if (
    leapsUp.landed >= TENDENCY_NOTES &&
    leapsUp.meanCents !== null &&
    leapsUp.meanCents <= -TENDENCY_CENTS
  ) {
    return { moment: 'resultLeapsFlat', fields: counts }
  }
  if (
    stepsDown.landed >= TENDENCY_NOTES &&
    stepsDown.meanCents !== null &&
    stepsDown.meanCents >= TENDENCY_CENTS
  ) {
    return { moment: 'resultStepsSharp', fields: counts }
  }
  const share = metrics.notes > 0 ? metrics.landed / metrics.notes : 0
  const endsShare =
    lastNotes.notes > 0 ? lastNotes.landed / lastNotes.notes : share
  if (metrics.landed > 0 && share - endsShare >= ENDS_SHARE_GAP) {
    return { moment: 'resultEnds', fields: counts }
  }
  return { moment: 'result', fields: counts }
}

/** What keeping a run said: a new best, and the best before it. */
export interface KeptRun {
  readonly improved: boolean
}

/**
 * A finished run is kept: the exercise history, the best at its level and
 * the root its first phrase started on. A run that landed nothing is kept
 * in the history too (it was sung), but it is never a best.
 */
export function keepEchoRun(
  level: EchoLevelId,
  metrics: SequenceMetrics,
  root: number,
  now: number = Date.now(),
): KeptRun {
  recordExerciseResult({
    type: EXERCISE_ECHO_STARS,
    score:
      metrics.notes > 0
        ? Math.round((100 * metrics.landed) / metrics.notes)
        : 0,
    metrics: {
      landed: metrics.landed,
      notes: metrics.notes,
      ...(metrics.accuracy === null ? {} : { accuracy: metrics.accuracy }),
      ...(metrics.rhythm === null ? {} : { inTime: metrics.rhythm.inTime }),
    },
    completedAt: now,
  })
  rememberEchoRoot(root)
  if (metrics.landed === 0) return { improved: false }
  const { improved } = recordEchoBest(level, {
    landed: metrics.landed,
    notes: metrics.notes,
    accuracy: metrics.accuracy,
    at: now,
  })
  return { improved }
}

/** A run's numbers under its result. */
export interface EchoSummary {
  readonly landed: number
  readonly notes: number
  /** 0 to 100, or null when nothing landed. */
  readonly accuracy: number | null
  /** Notes landed in time, at a level that judges rhythm; else null. */
  readonly inTime: number | null
  readonly improved: boolean
  /** The level the run was sung at ("Singer"). */
  readonly levelName: string
}

/** A result as the room shows it: its numbers, its sky, and whether to cheer. */
export interface ShownResult {
  readonly summary: EchoSummary
  readonly scene: SkyScene
  /** A new best or every note landed: the celebration, and Merc cheers. */
  readonly celebrate: boolean
}

/** The result of `done`, sung at `level` in run `run`. */
export function showResultOf(
  done: readonly PhraseTake[],
  metrics: SequenceMetrics,
  at: { level: EchoLevelId; run: number; improved: boolean },
): ShownResult {
  const all = metrics.notes > 0 && metrics.landed === metrics.notes
  const celebrate = at.improved || all
  return {
    summary: {
      landed: metrics.landed,
      notes: metrics.notes,
      accuracy: metrics.accuracy,
      inTime: metrics.rhythm?.inTime ?? null,
      improved: at.improved,
      levelName: exerciseLevelName(at.level),
    },
    scene: echoScene({
      run: at.run,
      live: null,
      done: [...done],
      result: true,
      celebration: celebrate,
    }),
    celebrate,
  }
}
