// ============================================================
// Glide targets — where Ng slides and Lip roll sit in the singer's voice (pure)
// ============================================================
//
// Ng slides (DESIGN-ng-slides.md §2): the first slide's root is the newest
// voiceprint's low end plus 15 % of its span, on a natural note; five
// slides climb a semitone each, every one up a fifth, so the highest note
// is root + 11. When that passes 85 % of the span the run steps down from
// the top instead: the first slide's top sits at that ceiling (the
// highest whole note under it) and the fifth slide is the lowest. A span under 13 semitones gets five slides on
// one root.
//
// Lip roll (DESIGN-lip-roll.md §2): the first wave's root is the low end
// plus 10 %, on a natural note; the crest is an octave up, or the span less
// two semitones when the span is under 14. Waves 2 and 3 start two and
// four semitones higher when the highest crest stays under 95 % of the
// span; otherwise all three start on the root.
//
// A voiceprint's range is read as the exercises read it: at most two
// octaves under its top (practiceRange in hold-target.ts), so a slide that
// dipped into a growl does not drag the first root under the voice.
//
// No voiceprint: a comfortable note (the one the singer settled on in the
// "sing any easy note" pre-roll, else the voice type's own note, tenor as
// in Long note), and the root four semitones under it. With no span to
// check, Ng slides climb as usual (its highest note is a fifth over the
// comfortable note) and Lip roll keeps all three waves on the root.
//
// Pure: the voiceprints, the settled note and the voice type come in as
// arguments, as for Echo's phrase window (phrase-fit.ts).

import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { HoldVoicePreset, VoiceprintRange } from '@/lib/hold/hold-target'
import { HOLD_DEFAULT_PRESET, HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, latestPracticeRange, nearestNaturalMidi, } from '@/lib/hold/hold-target'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import { LIP_ROLL_SEMITONES, LIP_ROLL_WAVES, NG_SLIDE_COUNT, NG_SLIDE_SEMITONES, } from './glide-path'

export type GlideTargetSource = 'voiceprint' | 'settled' | 'preset'

export interface GlideTargets {
  /** Each arch's root, MIDI, in the order sung. */
  readonly roots: readonly number[]
  /** How far each arch rises, semitones. */
  readonly semitones: number
  /** What set the roots. */
  readonly source: GlideTargetSource
}

export interface GlideTargetInput {
  readonly voiceprints: readonly VoiceprintRecord[]
  /** The note the singer settled on in the pre-roll (fractional MIDI). */
  readonly settledMidi?: number | null
  readonly voicePreset?: HoldVoicePreset
}

/** Ng: where the first root sits in the span, from the bottom. */
export const NG_ROOT_SPAN_FRACTION = 0.15
/** Ng: the highest note stays under this share of the span. */
export const NG_CEILING_SPAN_FRACTION = 0.85
/** Ng: a span under this many semitones sings every slide on one root. */
export const NG_NARROW_SPAN = 13

/** Lip roll: where the first root sits in the span, from the bottom. */
export const LIP_ROLL_ROOT_SPAN_FRACTION = 0.1
/** Lip roll: the highest crest stays under this share of the span. */
export const LIP_ROLL_CEILING_SPAN_FRACTION = 0.95
/** Lip roll: under this span the crest is the span less two semitones. */
export const LIP_ROLL_NARROW_SPAN = 14
/** Lip roll: waves 2 and 3 start this far above the first. */
export const LIP_ROLL_WAVE_STEPS: readonly number[] = [0, 2, 4]

/** The root sits this far under the comfortable note, semitones. */
export const ROOT_UNDER_COMFORTABLE = 4

const clampMidi = (midi: number): number =>
  Math.max(HOLD_TARGET_MIN_MIDI, Math.min(HOLD_TARGET_MAX_MIDI, midi))

/** The comfortable note without a voiceprint, and what gave it. */
function comfortableNote(input: GlideTargetInput): {
  midi: number
  source: GlideTargetSource
} {
  const settled = input.settledMidi
  if (typeof settled === 'number' && Number.isFinite(settled)) {
    return { midi: clampMidi(Math.round(settled)), source: 'settled' }
  }
  const preset = input.voicePreset ?? HOLD_DEFAULT_PRESET
  return { midi: getComfortableMidiRange(preset).default, source: 'preset' }
}

/** A root `fraction` of the way up the range, on a natural note. */
function naturalRootIn(range: VoiceprintRange, fraction: number): number {
  return clampMidi(
    nearestNaturalMidi(range.low + fraction * (range.high - range.low)),
  )
}

/** Ng slides on a voiceprint's range (see the header). */
export function ngRootsForRange(range: VoiceprintRange): number[] {
  const span = range.high - range.low
  const root = naturalRootIn(range, NG_ROOT_SPAN_FRACTION)
  if (span < NG_NARROW_SPAN) return Array<number>(NG_SLIDE_COUNT).fill(root)
  const last = NG_SLIDE_COUNT - 1
  const ceiling = range.low + NG_CEILING_SPAN_FRACTION * span
  if (root + last + NG_SLIDE_SEMITONES <= ceiling + 1e-9) {
    return Array.from({ length: NG_SLIDE_COUNT }, (_, k) => root + k)
  }
  // Step down from the top: slide 1's top at the ceiling, slide 5 lowest.
  // Not rounded to a natural note: rounding down could put slide 5 under
  // the span, which is what stepping down is for.
  const first = Math.floor(ceiling + 1e-9) - NG_SLIDE_SEMITONES
  return Array.from({ length: NG_SLIDE_COUNT }, (_, k) => first - k)
}

/** Ng slides fitted to the singer: five roots, each slide up a fifth. */
export function fitNgSlides(input: GlideTargetInput): GlideTargets {
  const range = latestPracticeRange(input.voiceprints)
  if (range !== null) {
    return {
      roots: ngRootsForRange(range),
      semitones: NG_SLIDE_SEMITONES,
      source: 'voiceprint',
    }
  }
  const comfortable = comfortableNote(input)
  const root = comfortable.midi - ROOT_UNDER_COMFORTABLE
  return {
    roots: Array.from({ length: NG_SLIDE_COUNT }, (_, k) => root + k),
    semitones: NG_SLIDE_SEMITONES,
    source: comfortable.source,
  }
}

/** Lip roll on a voiceprint's range (see the header). */
export function lipRollForRange(range: VoiceprintRange): {
  roots: number[]
  semitones: number
} {
  const span = range.high - range.low
  const root = naturalRootIn(range, LIP_ROLL_ROOT_SPAN_FRACTION)
  const semitones =
    span < LIP_ROLL_NARROW_SPAN
      ? Math.max(1, Math.floor(span) - 2)
      : LIP_ROLL_SEMITONES
  const ceiling = range.low + LIP_ROLL_CEILING_SPAN_FRACTION * span
  const highest = root + LIP_ROLL_WAVE_STEPS[LIP_ROLL_WAVES - 1] + semitones
  const roots =
    highest < ceiling
      ? LIP_ROLL_WAVE_STEPS.map((step) => root + step)
      : Array<number>(LIP_ROLL_WAVES).fill(root)
  return { roots, semitones }
}

/** Lip roll fitted to the singer: three roots and the crest's height. */
export function fitLipRoll(input: GlideTargetInput): GlideTargets {
  const range = latestPracticeRange(input.voiceprints)
  if (range !== null) return { ...lipRollForRange(range), source: 'voiceprint' }
  const comfortable = comfortableNote(input)
  const root = comfortable.midi - ROOT_UNDER_COMFORTABLE
  return {
    roots: Array<number>(LIP_ROLL_WAVES).fill(root),
    semitones: LIP_ROLL_SEMITONES,
    source: comfortable.source,
  }
}
