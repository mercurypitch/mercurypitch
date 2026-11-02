// ============================================================
// A Harmony run — its numbers, its lines, what it keeps, what Merc says
// ============================================================
//
// The live run's end, out of useHarmonyController: the run's numbers, its
// lines as the result's rows draw them, whether it was a run at all, what
// it leaves behind and Merc's lines over a line and over the result.
//
// A run in which no voice was heard is not a run (an aborted run is not a
// result): keeping six silent lines would put a zero in the singer's
// history they never sang. Every other finished run is kept, once,
// through recordExerciseResult (which credits practice and the streak),
// and the level's best takes it when it beats the last.

import { EXERCISE_HARMONY_LAKE } from '@/lib/domain/exercise-contracts'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { recordHarmonyBest } from '@/stores/harmony-store'
import type { HarmonyLine } from './harmony-line'
import type { LineOutcome } from './harmony-machine'
import type { HarmonyWay } from './harmony-rules'
import type { HarmonyLineFields, HarmonyMoment } from './merc-lines'

export interface HarmonySummary {
  /** Lines with every note in harmony. */
  readonly inHarmony: number
  readonly lines: number
  /** Notes sung in harmony, and all the run's notes. */
  readonly notesLanded: number
  readonly notes: number
  /** Any line sat a third below Merc's. */
  readonly anyBelow: boolean
  /** Any voice was heard in the run. */
  readonly voiced: boolean
}

/** The run's numbers, from its outcomes. */
export function summarizeRun(outcomes: readonly LineOutcome[]): HarmonySummary {
  const landed = (o: LineOutcome): number => o.notes.filter(Boolean).length
  return {
    inHarmony: outcomes.filter((o) => o.inHarmony).length,
    lines: outcomes.length,
    notesLanded: outcomes.reduce((sum, o) => sum + landed(o), 0),
    notes: outcomes.reduce((sum, o) => sum + o.notes.length, 0),
    anyBelow: outcomes.some((o) => o.line.below),
    voiced: outcomes.some((o) => o.voiced),
  }
}

/** The result's line under the count: the notes sung in harmony. */
export function detailLine(summary: HarmonySummary): string {
  const where = summary.anyBelow ? 'a third away' : 'a third above'
  return `${summary.notesLanded} of ${summary.notes} notes ${where}`
}

/** A line's notes by name: "B3 C4 D4 C4". */
export function noteNames(notes: readonly number[]): string {
  return notes.map((midi) => midiToNoteNameOctave(midi)).join(' ')
}

/** One of the result's rows: a line of the run and how its notes went. */
export interface HarmonyRow {
  readonly line: HarmonyLine
  /** "Line 1". */
  readonly label: string
  /** The harmony's notes by name, as the singer sang them. */
  readonly names: string
  /** Each note of the harmony: landed or not. */
  readonly notes: readonly boolean[]
  readonly landed: number
}

/** The run's lines as the result lists them, in the run's order. */
export function harmonyRows(outcomes: readonly LineOutcome[]): HarmonyRow[] {
  return outcomes.map((outcome) => ({
    line: outcome.line,
    label: `Line ${outcome.line.index + 1}`,
    names: noteNames(outcome.line.harmony),
    notes: outcome.notes,
    landed: outcome.notes.filter(Boolean).length,
  }))
}

/** What Merc says before a line, at this level and way. */
export function callMoment(
  line: HarmonyLine,
  way: HarmonyWay,
  mercSingsBoth: boolean,
): HarmonyMoment {
  if (line.below) return 'callBelow'
  if (way === 'together') return 'callTogether'
  return mercSingsBoth ? 'callBoth' : 'call'
}

/** What Merc says over a line sung in harmony. */
export function landedMoment(line: HarmonyLine): HarmonyMoment {
  return line.below ? 'landedBelow' : 'landed'
}

/** What Merc says over a missed note: silent, short of it, past it, or not quite. */
export function missedMoment(outcome: LineOutcome): HarmonyMoment {
  if (!outcome.voiced) return 'missedSilent'
  if (outcome.short === true) return 'missedShort'
  if (outcome.short === false) return 'missedOver'
  return 'missed'
}

/** The missed note's pair, as Merc's line names it; null for no miss. */
export function missedFields(
  outcome: LineOutcome,
): Required<HarmonyLineFields> | null {
  const at = outcome.firstMiss
  if (at === null) return null
  return {
    from: midiToNoteNameOctave(outcome.line.merc[at]),
    note: midiToNoteNameOctave(outcome.line.harmony[at]),
    way: outcome.line.below ? 'below' : 'above',
  }
}

export interface KeptRun {
  /** The run was kept (any voice was heard). */
  readonly kept: boolean
  /** It beat the level's previous best. */
  readonly improved: boolean
}

/** A finished run is kept: the history, and the level's best. */
export function keepHarmonyRun(
  level: ExerciseLevel,
  way: HarmonyWay,
  summary: HarmonySummary,
  now: number = Date.now(),
): KeptRun {
  if (!summary.voiced || summary.lines === 0 || summary.notes === 0) {
    return { kept: false, improved: false }
  }
  recordExerciseResult({
    type: EXERCISE_HARMONY_LAKE,
    score: Math.round((100 * summary.notesLanded) / summary.notes),
    metrics: {
      linesInHarmony: summary.inHarmony,
      lines: summary.lines,
      notesInHarmony: summary.notesLanded,
      notes: summary.notes,
      sungTogether: way === 'together' ? 1 : 0,
    },
    completedAt: now,
  })
  const { improved } = recordHarmonyBest(level, {
    inHarmony: summary.inHarmony,
    lines: summary.lines,
    notesLanded: summary.notesLanded,
    notes: summary.notes,
    at: now,
  })
  return { kept: true, improved }
}

/** What Merc says over the result. */
export function resultMoment(
  summary: HarmonySummary,
  kept: KeptRun,
): HarmonyMoment {
  if (!kept.kept) return 'silentRun'
  if (kept.improved) return 'newBest'
  if (summary.inHarmony === summary.lines) return 'resultAll'
  if (summary.notesLanded === 0) return 'resultNone'
  return summary.inHarmony * 2 >= summary.lines ? 'resultMost' : 'resultSome'
}
