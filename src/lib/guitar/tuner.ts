// ============================================================
// Guitar Tuner — pitch-to-string mapping and cent deviation
// ============================================================
//
// Standard 6-string guitar tuning (EADGBE, low to high). Accepts
// a detected frequency and returns the nearest string + cent
// deviation, so a tuner UI can show a needle / color indicator.
// Pure functions — no DOM, no audio.
//
// Reuses existing constants from guitar-synth.ts (GUITAR_TUNING,
// GUITAR_STRINGS) and note-utils.ts (midiToNoteName, NOTE_NAMES).

import { computeCentsDeviation, frequencyToMidi, midiToNoteName, } from '@/lib/frequency-to-note'
import { GUITAR_STRINGS, GUITAR_TUNING } from '@/lib/guitar/guitar-synth'

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
export const ALTERNATE_TUNINGS: Record<string, number[]> = {
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
  /** Nearest standard string name (e.g. "A2"). */
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

// ── String names (derived from GUITAR_STRINGS for reuse) ──────

/** Standard tuning string names in display order (low→high). */
export const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] as const

/** Standard-tuning open-string frequencies (Hz), low→high. */
const STANDARD_TARGETS: number[] = STRING_NAMES.map((n) => GUITAR_TUNING[n])

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
 * Check whether a frequency is close enough to *any* guitar string
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
  return ALTERNATE_TUNINGS[tuningName] ?? ALTERNATE_TUNINGS.Standard
}

/**
 * Get string names for a tuning preset (e.g. ["E2","A2","D3","G3","B3","E4"]).
 * Uses midiToNoteName from frequency-to-note.ts — no local note-name arrays.
 */
export function getTuningStringNames(tuningName: string): string[] {
  const freqs = getTuningFrequencies(tuningName)
  return freqs.map((f) => midiToNoteName(frequencyToMidi(f)))
}
