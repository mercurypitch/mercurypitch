// ============================================================
// Stringed instrument tuner — target selection and cent deviation
// ============================================================
//
// Host-neutral target and reading APIs accept the same 4–8-string guitar or
// bass tuning shown by the stage. The original low-to-high six-string preset
// exports stay intact for the legacy Guitar tuner.
//
// Reuses existing constants from guitar-synth.ts (GUITAR_TUNING,
// GUITAR_STRINGS) and the shared InstrumentTuning authority.

import { computeCentsDeviation, frequencyToMidi, midiToNoteName, } from '@/lib/frequency-to-note'
import { GUITAR_STRINGS, GUITAR_TUNING } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { instrumentTuningFromSource, soundingOpenMidi, } from '@/lib/guitar/instrument-tuning'

// ── Re-export for convenience ──────────────────────────────────

export { GUITAR_TUNING, GUITAR_STRINGS }

// ── Display labels ────────────────────────────────────────────

/** String labels for UI (musical notation, low→high). */
export const STRING_LABELS: Record<string, string> = {
  E2: 'E (low)',
  A2: 'A',
  D3: 'D',
  G3: 'G',
  B3: 'B',
  E4: 'e (high)',
}

/** Alternate tuning presets (Hz), low→high, 6 strings each. */
export const ALTERNATE_TUNINGS = {
  Standard: [
    GUITAR_TUNING.E2,
    GUITAR_TUNING.A2,
    GUITAR_TUNING.D3,
    GUITAR_TUNING.G3,
    GUITAR_TUNING.B3,
    GUITAR_TUNING.E4,
  ],
  'Drop D': [73.42, 110.0, 146.83, 196.0, 246.94, 329.63],
  'Half Step Down': [77.78, 103.83, 138.59, 185.0, 233.08, 311.13],
  // D2 G2 D3 G3 B3 D4 — low→high.
  'Open G': [73.42, 98.0, 146.83, 196.0, 246.94, 293.66],
  DADGAD: [73.42, 110.0, 146.83, 196.0, 220.0, 293.66],
}

/** Available tuning preset names. */
export type TuningPreset = keyof typeof ALTERNATE_TUNINGS

// ── Thresholds (exported for UI to use) ───────────────────────

/** Cent deviation at or below this marks a string "in tune". */
export const TUNER_IN_TUNE_CENTS = 5
/** Cent deviation at or below this marks a string "close". */
export const TUNER_CLOSE_CENTS = 15
/** Maximum cents from any open string to consider it a tuning signal. */
export const TUNER_MAX_SIGNAL_CENTS = 50
/** Minimum detection clarity to accept as a tuning attempt. */
export const TUNER_MIN_CLARITY = 0.3

// ── Result type ───────────────────────────────────────────────

export interface TunerResult {
  /** Detected frequency (Hz). */
  frequency: number
  /** Selected or nearest target string name (e.g. "A2"). */
  stringName: string
  /** Display label for the string. */
  stringLabel: string
  /** Target frequency for that string (Hz). */
  targetHz: number
  /** Deviation from target in cents. */
  centsDeviation: number
  /** Whether the note is in tune (±TUNER_IN_TUNE_CENTS). */
  inTune: boolean
  /** Whether we're close (±TUNER_CLOSE_CENTS). */
  close: boolean
  /** The MIDI note number of the detected pitch. */
  midi: number
  /** Detection clarity / confidence (0–1). */
  clarity: number
}

/** One open-string target in stage row order (highest string first). */
export interface TunerTarget {
  /** Stable row identity, including when two strings share a pitch. */
  stringIndex: number
  /** Sounding note name after capo (for example, "F#4"). */
  stringName: string
  /** Instrument row label before capo (for example, "e"). */
  stringLabel: string
  /** Sounding open MIDI pitch after capo. */
  targetMidi: number
  /** Target frequency at the requested concert pitch. */
  targetHz: number
}

/** A host-neutral tuner reading with its exact instrument-string identity. */
export interface TunerReading extends TunerResult {
  stringIndex: number
  targetMidi: number
}

export interface InstrumentPitchOptions {
  /**
   * Pin classification to one stage row. Manual selection intentionally
   * bypasses the auto-acquisition window so a badly detuned string still
   * produces useful direction.
   */
  targetStringIndex?: number
  /** Reference frequency for A4. Defaults to modern concert pitch (440 Hz). */
  concertPitchHz?: number
}

// ── String names (derived from GUITAR_STRINGS for reuse) ──────

/** Standard tuning string names in display order (low→high). */
export const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] as const

/** Standard-tuning open-string frequencies (Hz), low→high. */
const STANDARD_TARGETS: number[] = STRING_NAMES.map((n) => GUITAR_TUNING[n])

const DEFAULT_CONCERT_PITCH_HZ = 440

function targetFrequency(midi: number, concertPitchHz: number): number {
  return concertPitchHz * 2 ** ((midi - 69) / 12)
}

function resolvedConcertPitch(concertPitchHz: number | undefined): number {
  return concertPitchHz !== undefined &&
    Number.isFinite(concertPitchHz) &&
    concertPitchHz > 0
    ? concertPitchHz
    : DEFAULT_CONCERT_PITCH_HZ
}

// ── Core logic ────────────────────────────────────────────────

/**
 * Map a detected frequency to the nearest string of a given tuning.
 * Returns the closest open-string target and cent deviation.
 *
 * `targets` / `names` describe the tuning to classify against (low→high,
 * same length). Defaults to standard EADGBE so callers that don't care
 * about alternate tunings keep working. Returns null when the nearest
 * string is more than TUNER_MAX_SIGNAL_CENTS away — i.e. the detected
 * pitch is off-string noise, not a real tuning attempt.
 */
export function classifyPitch(
  frequency: number,
  clarity: number,
  targets: number[] = STANDARD_TARGETS,
  names: string[] = STRING_NAMES as unknown as string[],
): TunerResult | null {
  // NaN-safe: `!(frequency > 0)` also rejects NaN, unlike `frequency <= 0`.
  if (!(frequency > 0) || clarity < TUNER_MIN_CLARITY) return null

  // Find the closest open string by semitone distance
  let bestIndex = 0
  let bestDistance = Infinity

  for (let i = 0; i < targets.length; i++) {
    const semitones = Math.abs(Math.log2(frequency / targets[i]) * 12)
    if (semitones < bestDistance) {
      bestDistance = semitones
      bestIndex = i
    }
  }

  const targetHz = targets[bestIndex]
  const bestName = names[bestIndex]

  // Cents via the shared util (midi space): both operands as MIDI numbers,
  // so 100 cents == 1 semitone exactly.
  const cents = computeCentsDeviation(
    frequencyToMidi(frequency, false),
    frequencyToMidi(targetHz, false),
  )
  const absCents = Math.abs(cents)

  const result: TunerResult = {
    frequency,
    stringName: bestName,
    stringLabel: STRING_LABELS[bestName] ?? bestName,
    targetHz,
    centsDeviation: Math.round(cents * 10) / 10,
    inTune: absCents <= TUNER_IN_TUNE_CENTS,
    close: absCents <= TUNER_CLOSE_CENTS,
    midi: frequencyToMidi(frequency),
    clarity,
  }

  // Signal gate: reject off-string noise so it can't read "in tune".
  if (!isTuningSignal(result)) return null

  return result
}

/**
 * Build tuner targets from the same tuning authority used by the fretboard.
 * Instrument tunings are highest-string first; the returned indices preserve
 * that order. A capo changes the sounding MIDI pitch and target frequency,
 * while the row label continues to identify the physical string.
 */
export function getTunerTargets(
  tuning: InstrumentTuning,
  concertPitchHz = DEFAULT_CONCERT_PITCH_HZ,
): TunerTarget[] {
  const referenceHz = resolvedConcertPitch(concertPitchHz)
  return soundingOpenMidi(tuning).map((targetMidi, stringIndex) => {
    const stringName = midiToNoteName(targetMidi)
    return {
      stringIndex,
      stringName,
      stringLabel: tuning.labels[stringIndex] ?? stringName,
      targetMidi,
      targetHz: targetFrequency(targetMidi, referenceHz),
    }
  })
}

/** Select the closest open string without applying the auto signal gate. */
export function findNearestTunerTarget(
  frequency: number,
  targets: readonly TunerTarget[],
): TunerTarget | null {
  if (!(frequency > 0) || !Number.isFinite(frequency) || targets.length === 0) {
    return null
  }

  let nearest: TunerTarget | null = null
  let nearestCents = Infinity
  for (const target of targets) {
    if (!(target.targetHz > 0) || !Number.isFinite(target.targetHz)) continue
    const cents = Math.abs(1200 * Math.log2(frequency / target.targetHz))
    if (cents < nearestCents) {
      nearest = target
      nearestCents = cents
    }
  }
  return nearest
}

/**
 * Classify against an explicit string target. Cents remain unrounded so the
 * host can smooth or format them without losing detector precision. There is
 * no ±50-cent gate here: explicit selection means the player wants guidance
 * even when a string starts far from pitch.
 */
export function classifyPitchAgainstTarget(
  frequency: number,
  clarity: number,
  target: TunerTarget,
): TunerReading | null {
  if (
    !(frequency > 0) ||
    !Number.isFinite(frequency) ||
    !Number.isFinite(clarity) ||
    clarity < TUNER_MIN_CLARITY ||
    !(target.targetHz > 0) ||
    !Number.isFinite(target.targetHz)
  ) {
    return null
  }

  const midi = frequencyToMidi(frequency, false)
  const centsDeviation = computeCentsDeviation(
    midi,
    frequencyToMidi(target.targetHz, false),
  )
  const absCents = Math.abs(centsDeviation)

  return {
    frequency,
    stringIndex: target.stringIndex,
    stringName: target.stringName,
    stringLabel: target.stringLabel,
    targetMidi: target.targetMidi,
    targetHz: target.targetHz,
    centsDeviation,
    inTune: absCents <= TUNER_IN_TUNE_CENTS,
    close: absCents <= TUNER_CLOSE_CENTS,
    midi: frequencyToMidi(frequency),
    clarity,
  }
}

/**
 * Classify a pitch against any valid 4–8-string guitar or bass tuning.
 *
 * Auto mode only acquires a reading within ±50 cents of the nearest open
 * string. That prevents room noise or a played fret from masquerading as a
 * tuned string. Passing `targetStringIndex` selects manual mode and keeps a
 * reading outside that window, which is necessary for a freshly restrung or
 * substantially detuned instrument.
 */
export function classifyInstrumentPitch(
  frequency: number,
  clarity: number,
  tuning: InstrumentTuning,
  options: InstrumentPitchOptions = {},
): TunerReading | null {
  const targets = getTunerTargets(tuning, options.concertPitchHz)
  const manualIndex = options.targetStringIndex
  const target =
    manualIndex === undefined
      ? findNearestTunerTarget(frequency, targets)
      : Number.isInteger(manualIndex)
        ? (targets[manualIndex] ?? null)
        : null
  if (target === null) return null

  const reading = classifyPitchAgainstTarget(frequency, clarity, target)
  if (reading === null) return null
  return manualIndex === undefined && !isTuningSignal(reading) ? null : reading
}

/**
 * Check whether a frequency is close enough to the selected instrument string
 * to be considered a tuning attempt.
 */
export function isTuningSignal(result: TunerResult): boolean {
  return Math.abs(result.centsDeviation) <= TUNER_MAX_SIGNAL_CENTS
}

/**
 * Get the target frequency for a specific string name.
 */
export function getTargetHz(stringName: string): number {
  return GUITAR_TUNING[stringName] ?? 0
}

/**
 * Get all open-string frequencies for a given tuning preset.
 */
export function getTuningFrequencies(tuningName: string): number[] {
  return (
    ALTERNATE_TUNINGS[tuningName as TuningPreset] ?? ALTERNATE_TUNINGS.Standard
  )
}

/**
 * Get string names for a tuning preset (e.g. ["E2","A2","D3","G3","B3","E4"]).
 * Uses midiToNoteName from frequency-to-note.ts — no local note-name arrays.
 */
export function getTuningStringNames(tuningName: string): string[] {
  const freqs = getTuningFrequencies(tuningName)
  return freqs.map((f) => midiToNoteName(frequencyToMidi(f)))
}

/**
 * Adapt a legacy six-string preset to the stage's tuning authority.
 * The preset table remains low-string first for GuitarTuner compatibility;
 * InstrumentTuning rows are high-string first, so this boundary reverses it.
 */
export function instrumentTuningForPreset(
  preset: TuningPreset,
): InstrumentTuning {
  const openMidiHighFirst = ALTERNATE_TUNINGS[preset]
    .map((frequency) => frequencyToMidi(frequency))
    .reverse()
  const tuning = instrumentTuningFromSource('guitar', openMidiHighFirst, {
    name: preset,
  })
  if (tuning === null) {
    throw new Error(`Invalid built-in guitar tuning preset: ${preset}`)
  }
  return tuning
}
