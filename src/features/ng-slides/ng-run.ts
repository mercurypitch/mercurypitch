// ============================================================
// One Ng slides run: its plan, its lines, its result and its records
// ============================================================
//
// The pure half of the run (useNgController.ts is the live half). A run
// is five slides fitted to the singer (fitNgSlides: the voiceprint's
// range, else the easy note they settled on, four semitones over the
// first root) at their level, after a count-in: the first root's tone,
// then a breath while the bridge rolls in.
//
// Merc says one line between slides, about the slide just sung, and one at
// the result (merc-lines.ts). Each picks the most useful thing to say in
// a fixed order: a jump first (the exercise is about sliding, not
// stepping), then a break, then a top that fell short or overshot (Pro),
// then the timing, then praise.

import type { GlideKept, GlidePlan, } from '@/components/room-kit/glide/glide-room-contract'
import { COUNT_IN_TONE_SEC } from '@/components/room-kit/glide/glide-room-contract'
import type { GlideArchHeard, GlideRecords, } from '@/components/room-kit/glide/glide-run'
import { countNear, glideArchHeard, keepGlideRun, missedTop, noteName, timingVerdict, } from '@/components/room-kit/glide/glide-run'
import { EXERCISE_NG_SLIDES_BRIDGE } from '@/lib/domain/exercise-contracts'
import type { GlideState } from '@/lib/glide/glide-engine'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import { ngSlidesPath } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import type { GlideTargets } from '@/lib/glide/glide-targets'
import { ngBest, recordNgBest, rememberNgNote } from '@/stores/ng-slides-store'
import type { NgFields, NgMoment } from './merc-lines'

// The room's tones, as long as every glide room's.
export {
  BREATH_TONE_SEC,
  COUNT_IN_TONE_SEC,
} from '@/components/room-kit/glide/glide-room-contract'
// The best's chip, as every glide room words it.
export { bestText } from '@/components/room-kit/glide/glide-run'

/** A slide this near fully lit is a clean one. */
const CLEAN_SHARE = 0.95

/** Five slides' roots and path, and the count-in before them. */
export type NgPlan = GlidePlan

/** The run's path from the fitted roots, at the level's timing. */
export function planNgRun(fit: GlideTargets, preset: GlidePreset): NgPlan {
  return {
    roots: fit.roots,
    path: ngSlidesPath(fit.roots, preset),
    countIn: COUNT_IN_TONE_SEC + preset.breathSec,
    source: fit.source,
  }
}

/** The line a run opens with, before the first slide. */
export function introLine(plan: NgPlan | null): {
  moment: NgMoment
  fields: NgFields
} {
  if (plan === null || plan.source === 'preset') {
    return { moment: 'introAny', fields: {} }
  }
  return { moment: 'intro', fields: { top: noteName(plan.roots[0] + 7) } }
}

/** One slide as the engine heard it, for its line. */
export interface SlideHeard extends GlideArchHeard {
  readonly arch: number
  readonly broke: boolean
}

/** What the engine knows of slide `arch` at its end. */
export function slideHeard(
  state: GlideState,
  arch: number,
  coverage: number,
  lit: boolean,
  lag: { sum: number; count: number },
  preset: GlidePreset,
): SlideHeard {
  return {
    arch,
    ...glideArchHeard(state, arch, coverage, lit, lag, preset),
    broke: state.breaks.some((b) => b.arch === arch),
  }
}

/**
 * Merc's line in the breath after a slide. `next` is the next slide's
 * root, `top` this slide's top note.
 */
export function slideLine(
  heard: SlideHeard,
  preset: GlidePreset,
  next: number,
  top: number,
): { moment: NgMoment; fields: NgFields } {
  const nextNote = { note: noteName(next) }
  if (!heard.voiced) return { moment: 'silent', fields: nextNote }
  if (heard.jumpNote !== null) {
    return { moment: 'jump', fields: { note: noteName(heard.jumpNote) } }
  }
  if (heard.broke) return { moment: 'break', fields: {} }
  const atTop = missedTop(heard)
  if (atTop !== null) {
    return {
      moment: atTop === 'under' ? 'topFlat' : 'topSharp',
      fields: { top: noteName(top) },
    }
  }
  const late = timingVerdict(heard, preset)
  if (late !== null) return { moment: late, fields: {} }
  if (heard.lit) {
    return {
      moment: heard.coverage >= CLEAN_SHARE ? 'archClean' : 'onPath',
      fields: {},
    }
  }
  return { moment: 'breath', fields: nextNote }
}

/** A run's numbers, as its result shows them. */
export interface NgSummary {
  /** The bridge lit, whole per cent: the big number. */
  readonly litPct: number
  /** Each arch's coverage, 0..1, in the order sung. */
  readonly arches: readonly number[]
  readonly archesLit: number
  readonly jumps: number
  /** The note it jumps near: the repeating one, else the first; or null. */
  readonly jumpNote: number | null
  readonly breaks: number
  /** Tops reached, at the level that judges them; else null. */
  readonly tops: number | null
  readonly slides: number
  readonly improved: boolean
  /** The best before this run, per cent; null on a first run. */
  readonly previousBest: number | null
  readonly levelName: string
}

export function summarize(
  result: GlideResult,
  kept: GlideKept,
  levelName: string,
): NgSummary {
  return {
    litPct: Math.round(result.litShare * 100),
    arches: result.arches.map((a) => a.coverage),
    archesLit: result.archesLit,
    jumps: result.jumps.length,
    jumpNote: result.flipNote ?? result.jumps[0]?.note ?? null,
    breaks: result.breaks.length,
    tops: result.topsReached,
    slides: result.arches.length,
    improved: kept.improved,
    previousBest: kept.previousBest,
    levelName,
  }
}

/** "No jumps", "1 jump near E3", "3 jumps near E3". */
export function jumpsText(summary: NgSummary): string {
  if (summary.jumps === 0) return 'No jumps'
  return countNear(summary.jumps, 'jump', summary.jumpNote)
}

/** "Tops 4 of 5" at Pro; null at a level that does not judge the top. */
export function topsText(summary: NgSummary): string | null {
  return summary.tops === null
    ? null
    : `Tops ${summary.tops} of ${summary.slides}`
}

/** Merc's line at the result, most useful first. */
export function resultLine(
  result: GlideResult,
  summary: NgSummary,
  preset: GlidePreset,
): { moment: NgMoment; fields: NgFields } {
  const pct = { pct: `${summary.litPct}%` }
  const clean =
    summary.jumps === 0 &&
    summary.breaks === 0 &&
    summary.archesLit === summary.slides
  if (clean) return { moment: 'resultClean', fields: {} }
  if (summary.improved) return { moment: 'newBest', fields: pct }
  if (result.flipNote !== null) {
    return { moment: 'resultFlip', fields: { note: noteName(result.flipNote) } }
  }
  const tops = result.topTendencyCents
  if (preset.top !== null && tops !== null && tops < -preset.top.tolCents) {
    return { moment: 'resultTopsFlat', fields: {} }
  }
  if (result.meanLagMs !== null && result.meanLagMs >= preset.lagMs / 2) {
    return { moment: 'resultLate', fields: {} }
  }
  return { moment: 'result', fields: pct }
}

/** Where an Ng slides run is kept: the history's row, and the bridge's records. */
const RECORDS: GlideRecords = {
  exercise: EXERCISE_NG_SLIDES_BRIDGE,
  archesLitKey: 'archesLit',
  rememberNote: (midi) => rememberNgNote(midi),
  best: (level) => ngBest(level),
  recordBest: (level, run) => recordNgBest(level, run),
}

/**
 * Keep a finished run: the history row, the level's best, and the easy
 * note the singer settled on (when they settled one this run).
 */
export function keepNgRun(
  level: GlideLevelId,
  result: GlideResult,
  settled: number | null,
  now: number = Date.now(),
): GlideKept {
  return keepGlideRun(RECORDS, level, result, settled, now)
}
