import { midiToNoteName } from '@/lib/frequency-to-note'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'

/**
 * Return the comfortable MIDI range for a given voice type preset.
 */
export function getComfortableMidiRange(preset: VocalRangePreset): {
  min: number
  max: number
  default: number
} {
  const range = VOCAL_RANGES[preset]
  return {
    min: (range.minOctave + 1) * 12, // C of minOctave
    max: (range.maxOctave + 1) * 12 + 11, // B of maxOctave
    default: (range.defaultOctave + 1) * 12, // C of defaultOctave
  }
}

/**
 * Returns a sensible default note name (e.g. 'A3') for the given voice type.
 * Tenor/baritone/bass default to A in their default octave; higher voices
 * default to C.
 */
export function getDefaultNote(preset: VocalRangePreset): string {
  const range = VOCAL_RANGES[preset]
  if (preset === 'soprano' || preset === 'mezzo-soprano' || preset === 'alto') {
    return midiToNoteName((range.defaultOctave + 1) * 12) // C of default octave
  }
  // tenor, baritone, bass — use A in the default octave
  return midiToNoteName(12 * (range.defaultOctave + 1) + 9) // A of default octave
}

/**
 * Generate chromatic note name options (e.g. ['C3','D3',...'B5']) across the
 * voice type's full comfortable range.
 */
export function getNoteOptions(preset: VocalRangePreset): string[] {
  const { min, max } = getComfortableMidiRange(preset)
  const notes: string[] = []
  for (let midi = min; midi <= max; midi++) {
    notes.push(midiToNoteName(midi))
  }
  return notes
}
