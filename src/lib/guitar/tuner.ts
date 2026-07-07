// ============================================================
// Guitar Tuner — pitch-to-string mapping and cent deviation
// ============================================================
//
// Standard 6-string guitar tuning (EADGBE, low to high). Accepts
// a detected frequency and returns the nearest string + cent
// deviation, so a tuner UI can show a needle / color indicator.
// Pure functions — no DOM, no audio.

/** Standard guitar open-string frequencies (Hz), low E → high e. */
export const GUITAR_TUNING_HZ: Record<string, number> = {
  E2: 82.41,
  A2: 110.0,
  D3: 146.83,
  G3: 196.0,
  B3: 246.94,
  E4: 329.63,
}

/** String names in display order (low → high). */
export const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] as const

/** String labels for UI (musical notation). */
export const STRING_LABELS: Record<string, string> = {
  E2: 'E (low)',
  A2: 'A',
  D3: 'D',
  G3: 'G',
  B3: 'B',
  E4: 'e (high)',
}

/** Alternate tunings (Hz), low→high. */
export const ALTERNATE_TUNINGS: Record<string, number[]> = {
  Standard: [82.41, 110.0, 146.83, 196.0, 246.94, 329.63],
  'Drop D': [73.42, 110.0, 146.83, 196.0, 246.94, 329.63],
  'Half Step Down': [77.78, 103.83, 138.59, 185.0, 233.08, 311.13],
  'Open G': [98.0, 73.42, 98.0, 123.47, 146.83, 196.0],
  DADGAD: [73.42, 110.0, 146.83, 196.0, 220.0, 293.66],
}

export interface TunerResult {
  /** Detected frequency (Hz). */
  frequency: number
  /** Nearest standard string name (e.g. "A2"). */
  stringName: string
  /** Display label for the string. */
  stringLabel: string
  /** Target frequency for that string (Hz). */
  targetHz: number
  /** Deviation from target in cents (-50 to +50 is typical). */
  centsDeviation: number
  /** Whether the note is in tune (±5 cents). */
  inTune: boolean
  /** Whether we're close (±15 cents). */
  close: boolean
  /** The MIDI note number of the detected pitch. */
  midi: number
  /** Detection clarity / confidence (0–1). */
  clarity: number
}

/** Tolerance band for "in tune" (±cents). */
const IN_TUNE_THRESHOLD = 5
/** Tolerance band for "close" (±cents). */
const CLOSE_THRESHOLD = 15

/**
 * Map a detected frequency to the nearest guitar string.
 * Returns the closest open-string target and cent deviation.
 *
 * When a frequency is far from any open string (e.g. a fretted note),
 * we still find the closest string — the tuner expects open strings
 * in practice, but this handles the general case gracefully.
 */
export function classifyPitch(
  frequency: number,
  clarity: number,
): TunerResult | null {
  if (frequency <= 0 || clarity < 0.3) return null

  // Find the closest open string
  let bestString: (typeof STRING_NAMES)[number] = STRING_NAMES[0]
  let bestDistance = Infinity

  for (const name of STRING_NAMES) {
    const target = GUITAR_TUNING_HZ[name]
    const ratio = frequency / target
    // Distance in octaves (log2 ratio * 12 = semitones)
    const semitones = Math.abs(Math.log2(ratio) * 12)
    if (semitones < bestDistance) {
      bestDistance = semitones
      bestString = name
    }
  }

  const targetHz = GUITAR_TUNING_HZ[bestString]
  const cents = 1200 * Math.log2(frequency / targetHz)
  const absCents = Math.abs(cents)

  // MIDI note from frequency (A4 = 440 Hz = MIDI 69)
  const midi = 69 + 12 * Math.log2(frequency / 440)

  return {
    frequency,
    stringName: bestString,
    stringLabel: STRING_LABELS[bestString],
    targetHz,
    centsDeviation: Math.round(cents * 10) / 10,
    inTune: absCents <= IN_TUNE_THRESHOLD,
    close: absCents <= CLOSE_THRESHOLD,
    midi: Math.round(midi),
    clarity,
  }
}

/**
 * Check whether a frequency is close enough to *any* guitar string
 * to be considered a tuning attempt (within 50 cents of some string).
 */
export function isTuningSignal(result: TunerResult): boolean {
  return Math.abs(result.centsDeviation) <= 50
}

/**
 * Get the target frequency for a specific string name.
 */
export function getTargetHz(stringName: string): number {
  return GUITAR_TUNING_HZ[stringName] ?? 0
}

/**
 * Get all open-string frequencies for a given tuning preset.
 */
export function getTuningFrequencies(tuningName: string): number[] {
  return ALTERNATE_TUNINGS[tuningName] ?? ALTERNATE_TUNINGS['Standard']
}

/**
 * Get string names for a tuning preset.
 */
export function getTuningStringNames(tuningName: string): string[] {
  const freqs = getTuningFrequencies(tuningName)
  // Map each frequency back to a note name
  return freqs.map((f) => {
    const midi = Math.round(69 + 12 * Math.log2(f / 440))
    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ]
    const name = noteNames[midi % 12]
    const octave = Math.floor(midi / 12) - 1
    return `${name}${octave}`
  })
}
