// ============================================================
// Stringed instrument tunings — what the stage is actually showing
// ============================================================
//
// A tab row means nothing without knowing the instrument under it. A four
// string bass numbers and names its strings differently from a six string
// guitar, and both differ from a seven or eight string. One tuning describes
// the rows, their names, and where a note is played.

/**
 * Standard tunings by string count, highest string first. Written out rather
 * than derived: extended-range instruments do not follow one rule. A seventh
 * and eighth guitar string are added below, but a six string bass adds a low B
 * *and* a high C, which no "extend downwards" shortcut would get right.
 */
const GUITAR_TUNINGS: Readonly<Record<number, readonly number[]>> = {
  4: [64, 59, 55, 50], //             e B G D
  5: [64, 59, 55, 50, 45], //         e B G D A
  6: [64, 59, 55, 50, 45, 40], //     e B G D A E
  7: [64, 59, 55, 50, 45, 40, 35], // e B G D A E B
  8: [64, 59, 55, 50, 45, 40, 35, 30], // e B G D A E B F#
}

const BASS_TUNINGS: Readonly<Record<number, readonly number[]>> = {
  4: [43, 38, 33, 28], //             G D A E
  5: [43, 38, 33, 28, 23], //         G D A E B
  6: [48, 43, 38, 33, 28, 23], //     C G D A E B
  7: [53, 48, 43, 38, 33, 28, 23], // F C G D A E B
  8: [53, 48, 43, 38, 33, 28, 23, 18], // F C G D A E B F#
}

const NOTE_NAMES = [
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
] as const

export type StringedInstrument = 'guitar' | 'bass'

export const MIN_STRING_COUNT = 4
export const MAX_STRING_COUNT = 8
export const DEFAULT_STRING_COUNT: Record<StringedInstrument, number> = {
  // The common instrument in each case, so the default is never a surprise.
  guitar: 6,
  bass: 4,
}

export interface InstrumentTuning {
  instrument: StringedInstrument
  stringCount: number
  /** Open pitches, highest string first — the order the stage draws rows. */
  openMidi: readonly number[]
  /** Row labels, highest string first. */
  labels: readonly string[]
}

export function clampStringCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_STRING_COUNT
  return Math.min(
    MAX_STRING_COUNT,
    Math.max(MIN_STRING_COUNT, Math.round(count)),
  )
}

/**
 * Name each row by pitch class. When one class appears twice — a guitar's two
 * E strings — the higher one is lowercased, which is how tab has always
 * distinguished them.
 */
export function tuningLabels(openMidiHighFirst: readonly number[]): string[] {
  const names = openMidiHighFirst.map((midi) => NOTE_NAMES[midi % 12])
  const seen = new Map<string, number>()
  for (const name of names) seen.set(name, (seen.get(name) ?? 0) + 1)

  const used = new Set<string>()
  return names.map((name, index) => {
    if ((seen.get(name) ?? 0) < 2) return name
    // Highest first, so the first occurrence of a duplicated class is the
    // higher-sounding string.
    if (!used.has(name)) {
      used.add(name)
      return openMidiHighFirst[index] > 47 ? name.toLowerCase() : name
    }
    return name
  })
}

export function standardTuning(
  instrument: StringedInstrument,
  stringCount: number = DEFAULT_STRING_COUNT[instrument],
): InstrumentTuning {
  const count = clampStringCount(stringCount)
  const table = instrument === 'guitar' ? GUITAR_TUNINGS : BASS_TUNINGS
  const openMidi =
    table[count] ?? table[DEFAULT_STRING_COUNT[instrument]] ?? GUITAR_TUNINGS[6]

  return {
    instrument,
    stringCount: openMidi.length,
    openMidi,
    labels: tuningLabels(openMidi),
  }
}

export const DEFAULT_GUITAR_TUNING = standardTuning('guitar')
export const DEFAULT_BASS_TUNING = standardTuning('bass')

/** Highest fret the stage is willing to place a note on. */
export const MAX_PLAYABLE_FRET = 24

/**
 * Place a pitch on this instrument, preferring the lowest fret that can reach
 * it. Returns null when the note is off the neck rather than pinning it to a
 * string that cannot sound it.
 */
export function assignStringForMidi(
  midi: number,
  tuning: InstrumentTuning,
): { stringIndex: number; fret: number } | null {
  let best: { stringIndex: number; fret: number } | null = null
  for (let index = 0; index < tuning.openMidi.length; index += 1) {
    const fret = midi - tuning.openMidi[index]
    if (fret < 0 || fret > MAX_PLAYABLE_FRET) continue
    if (best === null || fret < best.fret) best = { stringIndex: index, fret }
  }
  return best
}

/** Raise by whole octaves until this instrument can play it, keeping pitch class. */
export function liftIntoTuningRange(
  midi: number,
  tuning: InstrumentTuning,
): number {
  const lowest = tuning.openMidi[tuning.openMidi.length - 1] ?? 40
  let lifted = midi
  while (lifted < lowest) lifted += 12
  return lifted
}

/**
 * Whether authored fingering describes *this* instrument. Guitar Pro indexes
 * strings inside its own track's tuning, so a bass fingering read as guitar
 * rows lands on the wrong string with a fret from another neck.
 */
export function fingeringMatchesTuning(
  midi: number,
  stringIndex: number | undefined,
  fret: number | undefined,
  tuning: InstrumentTuning,
): boolean {
  if (stringIndex === undefined || fret === undefined) return false
  if (stringIndex < 0 || stringIndex >= tuning.openMidi.length) return false
  if (fret < 0 || fret > MAX_PLAYABLE_FRET) return false
  return tuning.openMidi[stringIndex] + fret === midi
}

/**
 * Guess the instrument a line was written for. A part that spends its time
 * below a guitar's low E is a bass part, and showing it on guitar rows is how
 * a tab ends up unreadable.
 */
export function suggestInstrumentForMidi(
  midiValues: readonly number[],
): StringedInstrument {
  if (midiValues.length === 0) return 'guitar'
  const guitarLowE =
    DEFAULT_GUITAR_TUNING.openMidi[DEFAULT_GUITAR_TUNING.openMidi.length - 1]
  const belowGuitar = midiValues.filter((midi) => midi < guitarLowE).length
  return belowGuitar / midiValues.length > 0.35 ? 'bass' : 'guitar'
}
