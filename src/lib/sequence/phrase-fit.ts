// ============================================================
// Phrase fit — where Echo's phrases sit in the singer's voice (pure)
// ============================================================
//
// The first phrase starts where Long note's note sits (pickHoldTarget,
// hold-target.ts): 35 % of the way up the newest voiceprint's practice
// range (two octaves at most, practiceRange), on a natural note. Every
// phrase then stays in the middle of that range, from 20 % to 80 % of the
// way up it, and each phrase's root moves a step
// (two semitones) up or down from the last one's, never out of that
// window. Merc sings in the singer's octave: a bass hears him low.
//
// The motif and the step are chosen together: of the bank's motifs (not
// the last phrase's) on either step, a phrase whose every note fits the
// window, one not sung yet in the run where there is one. Where nothing
// fits (an octave leap in a narrow voice), the phrase that pokes out least.
//
// No voiceprint: the root is the note the singer settled on in the room's
// "sing any easy note" pre-roll, else the voice type's own note (tenor, as
// Long note). The window keeps a voiceprint's shape around that root: the
// voice type's span, with the root 35 % of the way up it.
//
// Pure: the voiceprints, the settled note and the seed come in as
// arguments.

import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { HoldVoicePreset } from '@/lib/hold/hold-target'
import { HOLD_DEFAULT_PRESET, HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, HOLD_TARGET_SPAN_FRACTION, latestPracticeRange, pickHoldTarget, } from '@/lib/hold/hold-target'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import type { EchoPhrase, PhraseMode } from './phrase-bank'
import { ECHO_MOTIFS, echoPhrase, phraseModes, seededRandom, } from './phrase-bank'
import type { EchoLevelId } from './sequence-engine'
import { ECHO_LEVELS } from './sequence-engine'

/** The window's floor and ceiling, as fractions of the span from its low end. */
export const ECHO_WINDOW_LOW = 0.2
export const ECHO_WINDOW_HIGH = 0.8

/** How far a phrase's root moves from the last one's, semitones. */
export const ROOT_STEP = 2

/** Phrases in a run. */
export const ECHO_RUN_PHRASES = 5

export interface EchoWindow {
  /** The lowest note a phrase may use, MIDI (fractional). */
  readonly low: number
  /** The highest, MIDI (fractional). */
  readonly high: number
  /** The first phrase's root, MIDI. */
  readonly firstRoot: number
  /** What set the root: a voiceprint, the singer's settled note, the voice type. */
  readonly source: 'voiceprint' | 'settled' | 'preset'
}

const EPS = 1e-6

/** The window for a span from `low` to `high`. */
function windowOf(low: number, high: number) {
  const span = high - low
  return {
    low: low + ECHO_WINDOW_LOW * span,
    high: low + ECHO_WINDOW_HIGH * span,
  }
}

/**
 * Where a run's phrases may go. `settledMidi` is the note the singer
 * settled on (fractional MIDI, as the pre-roll hears it), or null.
 */
export function echoWindow(input: {
  voiceprints: readonly VoiceprintRecord[]
  settledMidi?: number | null
  voicePreset?: HoldVoicePreset
}): EchoWindow {
  const preset = input.voicePreset ?? HOLD_DEFAULT_PRESET
  const range = latestPracticeRange(input.voiceprints)
  if (range !== null) {
    const firstRoot = pickHoldTarget(input.voiceprints, preset).midi
    return {
      ...windowOf(range.low, range.high),
      firstRoot,
      source: 'voiceprint',
    }
  }
  const settled = input.settledMidi
  const hasSettled = typeof settled === 'number' && Number.isFinite(settled)
  const root = hasSettled
    ? Math.max(
        HOLD_TARGET_MIN_MIDI,
        Math.min(HOLD_TARGET_MAX_MIDI, Math.round(settled)),
      )
    : pickHoldTarget([], preset).midi
  const voice = getComfortableMidiRange(preset)
  const span = voice.max - voice.min
  const low = root - HOLD_TARGET_SPAN_FRACTION * span
  return {
    ...windowOf(low, low + span),
    firstRoot: root,
    source: hasSettled ? 'settled' : 'preset',
  }
}

/**
 * The roots the next phrase may take: a step down and a step up, those
 * inside the window; when neither is (a window under two steps wide), the
 * step toward its middle.
 */
export function nextRootChoices(
  previous: number,
  window: EchoWindow,
): number[] {
  const steps = [previous - ROOT_STEP, previous + ROOT_STEP]
  const inside = steps.filter(
    (root) => root >= window.low - EPS && root <= window.high + EPS,
  )
  if (inside.length > 0) return inside
  const middle = (window.low + window.high) / 2
  return [previous > middle ? previous - ROOT_STEP : previous + ROOT_STEP]
}

/** How far a phrase pokes out of the window, semitones; 0 when it fits. */
export function overshoot(phrase: EchoPhrase, window: EchoWindow): number {
  let out = 0
  for (const note of phrase.notes) {
    out = Math.max(out, window.low - note.midi, note.midi - window.high)
  }
  return out
}

/** One phrase: the motif and the root chosen together (see the header). */
function pickPhrase(
  level: EchoLevelId,
  mode: PhraseMode,
  roots: readonly number[],
  run: readonly EchoPhrase[],
  window: EchoWindow,
  random: () => number,
): EchoPhrase {
  const last = run[run.length - 1]
  const noteSeconds = ECHO_LEVELS[level].noteSeconds
  const scored = ECHO_MOTIFS[level]
    .filter((motif) => motif !== last?.motif)
    .flatMap((motif) =>
      roots.map((root) => echoPhrase(motif, mode, root, noteSeconds)),
    )
    .map((phrase) => ({
      phrase,
      over: overshoot(phrase, window),
      sung: run.some((p) => p.motif === phrase.motif && p.mode === mode),
    }))
  const least = Math.min(...scored.map((s) => s.over))
  const best = scored.filter((s) => s.over <= least + EPS)
  const fresh = best.filter((s) => !s.sung)
  const pool = fresh.length > 0 ? fresh : best
  return pool[Math.floor(random() * pool.length)].phrase
}

/**
 * A run of Echo's phrases at `level`, in `window`: the same every time for
 * the same seed ("Again" asks for a new one).
 */
export function planEchoRun(input: {
  level: EchoLevelId
  window: EchoWindow
  seed: number
  count?: number
}): EchoPhrase[] {
  const random = seededRandom(input.seed)
  const count = input.count ?? ECHO_RUN_PHRASES
  const modes = phraseModes(count, random)
  const run: EchoPhrase[] = []
  for (const mode of modes) {
    const last = run[run.length - 1]
    const roots =
      last === undefined
        ? [input.window.firstRoot]
        : nextRootChoices(last.root, input.window)
    run.push(pickPhrase(input.level, mode, roots, run, input.window, random))
  }
  return run
}
