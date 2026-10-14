// ============================================================
// Glide metrics — a glide run's result, read off the engine's final state
// ============================================================
//
// What the result screen and Merc's result line need (DESIGN-ng-slides.md
// §3 and §6, DESIGN-lip-roll.md §6): the lit share of the whole picture,
// the arches lit, the jumps and breaks with their notes, the mean lag, the
// tops reached and which way the tops lean.
//
// The lit share is the whole run's on-path time over its sung time, so a
// short arch does not weigh as much as a long one; with equal arches it is
// the mean of their coverages. A jump's note is where the voice was when it
// jumped: a register flip happens at a pitch of the voice, and a voice the
// level lets trail is behind the path when it flips. A break's note is the
// path's when the sound stopped, which is the note Merc names.

import type { GlideState } from './glide-engine'
import { archCoverage } from './glide-engine'
import type { GlidePath } from './glide-path'
import type { GlidePreset } from './glide-presets'

export interface GlideArchResult {
  /** On-path time over the arch's sung time, 0..1. */
  readonly coverage: number
  /** Coverage reached the level's line. */
  readonly lit: boolean
  /** The top note was reached; null where the level does not judge it. */
  readonly topReached: boolean | null
  /**
   * The voice against the top note over the top, mean of the held readings
   * (cents, - flat, + sharp); null when the voice was silent there.
   */
  readonly topCents: number | null
}

export interface GlideNote {
  /** The nearest note, MIDI. */
  readonly note: number
  readonly arch: number
  readonly t: number
}

export interface GlideResult {
  /** The run's on-path time over its sung time, 0..1. */
  readonly litShare: number
  readonly arches: readonly GlideArchResult[]
  readonly archesLit: number
  /** Where the voice jumped from, in time order. */
  readonly jumps: readonly GlideNote[]
  /** Where the path was when the sound stopped, in time order. */
  readonly breaks: readonly GlideNote[]
  /**
   * The note the voice jumps at in at least two arches: where it flips
   * register (Merc names it). The most arches wins, then the lower note;
   * null when no note repeats.
   */
  readonly flipNote: number | null
  /**
   * How far behind the path the voice ran while it followed it, ms (-
   * ahead), never more than the level allows; null when it never did.
   */
  readonly meanLagMs: number | null
  /** Tops reached; null where the level does not judge the top. */
  readonly topsReached: number | null
  /** The mean of the arches' top cents (- flat, + sharp); null if none. */
  readonly topTendencyCents: number | null
}

function archResult(
  state: GlideState,
  path: GlidePath,
  arch: number,
  preset: GlidePreset,
): GlideArchResult {
  const coverage = archCoverage(state, path, arch)
  const count = state.topCount[arch]
  return {
    coverage,
    lit: coverage >= preset.litShare - 1e-6,
    topReached: preset.top === null ? null : state.topReached[arch] === 1,
    topCents: count > 0 ? state.topSum[arch] / count : null,
  }
}

/** The note that repeats across the most arches; ties go lower. */
export function flipNoteOf(jumps: readonly GlideNote[]): number | null {
  const archesAt = new Map<number, Set<number>>()
  for (const jump of jumps) {
    const arches = archesAt.get(jump.note) ?? new Set<number>()
    arches.add(jump.arch)
    archesAt.set(jump.note, arches)
  }
  let best: number | null = null
  let most = 1
  for (const [note, arches] of archesAt) {
    const better =
      arches.size > most ||
      (arches.size === most && best !== null && note < best)
    if (better) {
      best = note
      most = arches.size
    }
  }
  return best
}

function meanOf(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** The run's result from the engine's state once it has ended (or now). */
export function computeGlideResult(
  state: GlideState,
  path: GlidePath,
  preset: GlidePreset,
): GlideResult {
  const arches = path.arches.map((arch) =>
    archResult(state, path, arch.index, preset),
  )
  let lit = 0
  let sung = 0
  for (const arch of path.arches) {
    lit += Math.min(state.litSeconds[arch.index], arch.end - arch.start)
    sung += arch.end - arch.start
  }
  const jumps = state.jumps.map((jump) => ({
    note: Math.round(jump.fromMidi),
    arch: jump.arch,
    t: jump.t,
  }))
  const breaks = state.breaks.map((mark) => ({
    note: Math.round(mark.midi),
    arch: mark.arch,
    t: mark.t,
  }))
  const tops = arches.flatMap((a) => (a.topCents === null ? [] : [a.topCents]))
  return {
    litShare: sung > 0 ? lit / sung : 0,
    arches,
    archesLit: arches.filter((a) => a.lit).length,
    jumps,
    breaks,
    flipNote: flipNoteOf(jumps),
    meanLagMs:
      state.lagCount > 0 ? (state.lagSum / state.lagCount) * 1000 : null,
    topsReached:
      preset.top === null
        ? null
        : arches.filter((a) => a.topReached === true).length,
    topTendencyCents: meanOf(tops),
  }
}
