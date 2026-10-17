// ============================================================
// A glide run's shared pure half: what an arch's end says, what is kept
// ============================================================
//
// What both glide rooms' run modules (Lip roll's lip-run.ts, Ng slides'
// ng-run.ts) read and keep the same way: an arch's end as the engine
// heard it (glideArchHeard), the timing's verdict, the chips' "near a
// note" counts and the best, and a finished run kept in the history and
// the room's records (keepGlideRun). The room keeps its own words: its
// moments, its summary's names and the lines it picks.

import type { ExerciseType } from '@/lib/domain/exercise-contracts'
import type { GlideState } from '@/lib/glide/glide-engine'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import type { NgBest } from '@/lib/glide/ng-bests'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import type { GlideKept } from './glide-room-contract'

/** A note's name, to the nearest semitone: "G3". */
export const noteName = (midi: number): string =>
  midiToNoteNameOctave(Math.round(midi))

/** An arch as the engine heard it at its end: what every glide room reads. */
export interface GlideArchHeard {
  readonly coverage: number
  readonly lit: boolean
  readonly voiced: boolean
  /** The note it jumped near, MIDI, if it jumped. */
  readonly jumpNote: number | null
  /** The top's reading against its note, cents; null where not judged. */
  readonly topCents: number | null
  readonly topReached: boolean | null
  /** The voice's mean lag over the arch, s (- ahead); null if none. */
  readonly lagSec: number | null
}

/** What the engine knows of arch `arch` at its end. */
export function glideArchHeard(
  state: GlideState,
  arch: number,
  coverage: number,
  lit: boolean,
  lag: { sum: number; count: number },
  preset: GlidePreset,
): GlideArchHeard {
  const jump = state.jumps.find((j) => j.arch === arch)
  const count = state.topCount[arch]
  return {
    coverage,
    lit,
    voiced: state.archVoiced[arch] === 1,
    jumpNote: jump === undefined ? null : jump.fromMidi,
    topCents:
      preset.top === null || count === 0 ? null : state.topSum[arch] / count,
    topReached: preset.top === null ? null : state.topReached[arch] === 1,
    lagSec: lag.count > 0 ? lag.sum / lag.count : null,
  }
}

/** The timing's verdict: behind or ahead by over half the allowance. */
export function timingVerdict(
  heard: GlideArchHeard,
  preset: GlidePreset,
): 'behind' | 'ahead' | null {
  if (heard.lagSec === null) return null
  if (heard.lagSec > preset.lagMs / 2000) return 'behind'
  if (heard.lagSec < -preset.leadMs / 2000) return 'ahead'
  return null
}

/** A top the level judges and the voice missed: under its note, or over. */
export function missedTop(heard: GlideArchHeard): 'under' | 'over' | null {
  if (heard.topReached !== false || heard.topCents === null) return null
  return heard.topCents < 0 ? 'under' : 'over'
}

/** "1 jump", "3 breaks near G3": a count of `noun`, near its note if any. */
export function countNear(
  count: number,
  noun: string,
  note: number | null,
): string {
  const counted = count === 1 ? `1 ${noun}` : `${count} ${noun}s`
  return note === null ? counted : `${counted} near ${noteName(note)}`
}

/** What the best's chip reads of a run's summary. */
export interface GlideBestFields {
  /** The share lit, whole per cent. */
  readonly litPct: number
  readonly improved: boolean
  /** The best before this run, per cent; null on a first run. */
  readonly previousBest: number | null
}

/** "New best" or "Best 84%"; null on a first run that lit nothing. */
export function bestText(summary: GlideBestFields): string | null {
  if (summary.improved) return 'New best'
  const best = Math.max(summary.previousBest ?? 0, summary.litPct)
  return best > 0 ? `Best ${best}%` : null
}

/** Where a glide room keeps a run: its history row's names and its store. */
export interface GlideRecords {
  readonly exercise: ExerciseType
  /** The history row's name for the arches lit ("wavesLit", "archesLit"). */
  readonly archesLitKey: string
  rememberNote: (midi: number) => void
  best: (level: GlideLevelId) => { readonly lit: number } | null
  recordBest: (
    level: GlideLevelId,
    run: NgBest,
  ) => {
    readonly improved: boolean
    readonly previous: { readonly lit: number } | null
  }
}

/**
 * Keep a finished run: the history row, the level's best, and the easy
 * note the singer settled on (when they settled one this run).
 */
export function keepGlideRun(
  records: GlideRecords,
  level: GlideLevelId,
  result: GlideResult,
  settled: number | null,
  now: number,
): GlideKept {
  const lit = Math.round(result.litShare * 100)
  recordExerciseResult({
    type: records.exercise,
    score: lit,
    metrics: {
      lit,
      [records.archesLitKey]: result.archesLit,
      jumps: result.jumps.length,
      breaks: result.breaks.length,
      ...(result.topsReached === null ? {} : { tops: result.topsReached }),
      ...(result.meanLagMs === null
        ? {}
        : { lagMs: Math.round(result.meanLagMs) }),
    },
    completedAt: now,
  })
  if (settled !== null) records.rememberNote(Math.round(settled))
  // A run that lit nothing is kept in the history, not as a best.
  if (lit === 0) {
    return { improved: false, previousBest: records.best(level)?.lit ?? null }
  }
  const outcome = records.recordBest(level, {
    lit,
    arches: result.archesLit,
    jumps: result.jumps.length,
    at: now,
  })
  return {
    improved: outcome.improved,
    previousBest: outcome.previous?.lit ?? null,
  }
}
