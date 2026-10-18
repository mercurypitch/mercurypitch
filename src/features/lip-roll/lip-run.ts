// ============================================================
// One Lip roll run: its plan, its lines, its result and its records
// ============================================================
//
// The pure half of the run (useLipController.ts is the live half). A run
// is three waves fitted to the singer (fitLipRoll: the voiceprint's range,
// else the easy note they settled on, four semitones over the first root),
// each up an octave (or the span less two, for a narrow voice) and back,
// at their level, after a count-in: the first root's tone, then a breath
// while the bay rolls in.
//
// Merc says one line between waves, about the wave just sung, and one at
// the result (merc-lines.ts). Each picks the most useful thing to say in
// a fixed order: no voice at all first (a tip for the lips), then a jump
// (where the voice flips), then a break (where the sound stopped), then a
// top that fell short or overshot (Pro), then the timing, then praise.

import type { GlideKept, GlideLine, GlidePlan, } from '@/components/room-kit/glide/glide-room-contract'
import { COUNT_IN_TONE_SEC } from '@/components/room-kit/glide/glide-room-contract'
import type { GlideArchHeard, GlideRecords, } from '@/components/room-kit/glide/glide-run'
import { countNear, glideArchHeard, keepGlideRun, missedTop, noteName, timingVerdict, } from '@/components/room-kit/glide/glide-run'
import { EXERCISE_LIP_ROLL_BAY } from '@/lib/domain/exercise-contracts'
import type { GlideState } from '@/lib/glide/glide-engine'
import type { GlideNote, GlideResult } from '@/lib/glide/glide-metrics'
import { lipRollPath } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import type { GlideTargets } from '@/lib/glide/glide-targets'
import { lipBest, recordLipBest, rememberLipNote, } from '@/stores/lip-roll-store'
import type { LipMoment } from './merc-lines'

// The room's tones, as long as every glide room's.
export {
  BREATH_TONE_SEC,
  COUNT_IN_TONE_SEC,
} from '@/components/room-kit/glide/glide-room-contract'
// The best's chip, as every glide room words it.
export { bestText } from '@/components/room-kit/glide/glide-run'

/** A wave this near fully lit is a clean one. */
const CLEAN_SHARE = 0.95
/** A take that broke this often gets the "oo works too" line. */
const TIP_OO_BREAKS = 3

export interface LipPlan extends GlidePlan {
  /** How far each wave rises, semitones (an octave, or less). */
  readonly semitones: number
}

/** The run's path from the fitted roots, at the level's timing. */
export function planLipRun(fit: GlideTargets, preset: GlidePreset): LipPlan {
  return {
    roots: fit.roots,
    semitones: fit.semitones,
    path: lipRollPath(fit.roots, fit.semitones, preset),
    countIn: COUNT_IN_TONE_SEC + preset.breathSec,
    source: fit.source,
  }
}

/**
 * The line a run opens with, before the first wave. In the Warm-up
 * (`routine`) Merc's cue, without the top.
 */
export function introLine(
  plan: LipPlan | null,
  routine = false,
): GlideLine<LipMoment> {
  if (plan === null || plan.source === 'preset') {
    return { moment: 'introAny', fields: {} }
  }
  if (routine) return { moment: 'routine', fields: {} }
  return {
    moment: 'intro',
    fields: { top: noteName(plan.roots[0] + plan.semitones) },
  }
}

/** One wave as the engine heard it, for its line. */
export interface WaveHeard extends GlideArchHeard {
  readonly wave: number
  /** The path's note where the sound stopped, MIDI, if it broke. */
  readonly breakNote: number | null
}

/** What the engine knows of wave `wave` at its end. */
export function waveHeard(
  state: GlideState,
  wave: number,
  coverage: number,
  lit: boolean,
  lag: { sum: number; count: number },
  preset: GlidePreset,
): WaveHeard {
  const broke = state.breaks.find((b) => b.arch === wave)
  return {
    wave,
    ...glideArchHeard(state, wave, coverage, lit, lag, preset),
    breakNote: broke === undefined ? null : broke.midi,
  }
}

/**
 * Merc's line in the breath after a wave. `next` is the next wave's root,
 * `top` this wave's top note.
 */
export function waveLine(
  heard: WaveHeard,
  preset: GlidePreset,
  next: number,
  top: number,
): GlideLine<LipMoment> {
  if (!heard.voiced) return { moment: 'tip', fields: {} }
  if (heard.jumpNote !== null) {
    return { moment: 'jump', fields: { note: noteName(heard.jumpNote) } }
  }
  if (heard.breakNote !== null) {
    return { moment: 'break', fields: { note: noteName(heard.breakNote) } }
  }
  const atTop = missedTop(heard)
  if (atTop !== null) {
    return {
      moment: atTop === 'under' ? 'shortTop' : 'pastTop',
      fields: { top: noteName(top) },
    }
  }
  const late = timingVerdict(heard, preset)
  if (late !== null) return { moment: late, fields: {} }
  if (heard.lit) {
    return {
      moment: heard.coverage >= CLEAN_SHARE ? 'waveClean' : 'onPath',
      fields: {},
    }
  }
  return { moment: 'breath', fields: { note: noteName(next) } }
}

/** A run's numbers, as its result shows them. */
export interface LipSummary {
  /** The bay lit, whole per cent: the big number. */
  readonly litPct: number
  /** Each wave's coverage, 0..1, in the order sung. */
  readonly waves: readonly number[]
  readonly wavesLit: number
  readonly jumps: number
  /** The note it jumps near: the repeating one, else the first; or null. */
  readonly jumpNote: number | null
  readonly breaks: number
  /** The note the sound stops near: the most often, else the first; or null. */
  readonly breakNote: number | null
  /** Tops reached, at the level that judges them; else null. */
  readonly tops: number | null
  readonly waveCount: number
  readonly improved: boolean
  /** The best before this run, per cent; null on a first run. */
  readonly previousBest: number | null
  readonly levelName: string
}

/** The note most of these happened near; on a tie, the first of them. */
export function commonNote(marks: readonly GlideNote[]): number | null {
  if (marks.length === 0) return null
  const counts = new Map<number, number>()
  for (const mark of marks) {
    counts.set(mark.note, (counts.get(mark.note) ?? 0) + 1)
  }
  let best = marks[0].note
  for (const mark of marks) {
    if ((counts.get(mark.note) ?? 0) > (counts.get(best) ?? 0)) best = mark.note
  }
  return best
}

export function summarize(
  result: GlideResult,
  kept: GlideKept,
  levelName: string,
): LipSummary {
  return {
    litPct: Math.round(result.litShare * 100),
    waves: result.arches.map((a) => a.coverage),
    wavesLit: result.archesLit,
    jumps: result.jumps.length,
    jumpNote: result.flipNote ?? result.jumps[0]?.note ?? null,
    breaks: result.breaks.length,
    breakNote: commonNote(result.breaks),
    tops: result.topsReached,
    waveCount: result.arches.length,
    improved: kept.improved,
    previousBest: kept.previousBest,
    levelName,
  }
}

/** "No breaks", "1 break near G3", "2 breaks near G3". */
export function breaksText(summary: LipSummary): string {
  if (summary.breaks === 0) return 'No breaks'
  return countNear(summary.breaks, 'break', summary.breakNote)
}

/** "1 jump near E4", "3 jumps near E4"; null with none. */
export function jumpsText(summary: LipSummary): string | null {
  if (summary.jumps === 0) return null
  return countNear(summary.jumps, 'jump', summary.jumpNote)
}

/** "Tops 2 of 3" at Pro; null at a level that does not judge the top. */
export function topsText(summary: LipSummary): string | null {
  return summary.tops === null
    ? null
    : `Tops ${summary.tops} of ${summary.waveCount}`
}

/**
 * The result's chips: the breaks always (screen 4's one chip), the jumps
 * when there were any, the tops at Pro.
 */
export function resultChips(summary: LipSummary): string[] {
  return [breaksText(summary), jumpsText(summary), topsText(summary)].filter(
    (chip): chip is string => chip !== null,
  )
}

/** Merc's line at the result, most useful first. */
export function resultLine(
  result: GlideResult,
  summary: LipSummary,
  preset: GlidePreset,
): GlideLine<LipMoment> {
  const pct = { pct: `${summary.litPct}%` }
  const clean =
    summary.jumps === 0 &&
    summary.breaks === 0 &&
    summary.wavesLit === summary.waveCount
  if (clean) return { moment: 'resultClean', fields: {} }
  if (summary.improved) return { moment: 'newBest', fields: pct }
  if (result.flipNote !== null) {
    return { moment: 'resultFlip', fields: { note: noteName(result.flipNote) } }
  }
  if (summary.breaks >= TIP_OO_BREAKS) return { moment: 'tipOo', fields: {} }
  if (summary.breakNote !== null) {
    return {
      moment: 'resultBreaks',
      fields: { note: noteName(summary.breakNote) },
    }
  }
  const tops = result.topTendencyCents
  if (preset.top !== null && tops !== null && tops < -preset.top.tolCents) {
    return { moment: 'resultShort', fields: {} }
  }
  return { moment: 'result', fields: pct }
}

/** Where a Lip roll run is kept: the history's row, and the bay's records. */
const RECORDS: GlideRecords = {
  exercise: EXERCISE_LIP_ROLL_BAY,
  archesLitKey: 'wavesLit',
  rememberNote: (midi) => rememberLipNote(midi),
  best: (level) => lipBest(level),
  recordBest: (level, run) => recordLipBest(level, run),
}

/**
 * Keep a finished run: the history row, the level's best, and the easy
 * note the singer settled on (when they settled one this run).
 */
export function keepLipRun(
  level: GlideLevelId,
  result: GlideResult,
  settled: number | null,
  now: number = Date.now(),
): GlideKept {
  return keepGlideRun(RECORDS, level, result, settled, now)
}
