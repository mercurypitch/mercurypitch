// ============================================================
// Key shift — semitone range, speed compensation, key names
// ============================================================
//
// Pure maths for karaoke key change. A key shift is a whole number of
// semitones in −6..+6; ±4 is the range the backing stays clean in, and
// beyond it the control warns rather than refuses.
//
// Playback speed is a playbackRate, which on its own moves the pitch by
// 12·log2(rate) semitones. The shifter cancels that, so speed changes only
// the tempo: `shifterSemitones(key, rate)` is what the engine is told.

import { freqToMidiFloat } from '@/lib/pitch-pipeline/log-pitch'
import { KEY_OFFSETS, midiToNote, NOTE_NAMES } from '@/lib/scale-data'

export const KEY_SHIFT_MIN = -6
export const KEY_SHIFT_MAX = 6
export const KEY_SHIFT_CLEAN_LIMIT = 4

export function clampKeyShift(semitones: number): number {
  if (!Number.isFinite(semitones)) return 0
  const clamped = Math.min(
    KEY_SHIFT_MAX,
    Math.max(KEY_SHIFT_MIN, Math.round(semitones)),
  )
  return clamped === 0 ? 0 : clamped
}

export function isCleanKeyShift(semitones: number): boolean {
  return Math.abs(semitones) <= KEY_SHIFT_CLEAN_LIMIT
}

/** What the engine must shift by so `keyShift` is heard at `playbackRate`. */
export function shifterSemitones(
  keyShift: number,
  playbackRate: number,
): number {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) return keyShift
  return keyShift - 12 * Math.log2(playbackRate)
}

export function pitchRatio(semitones: number): number {
  return 2 ** (semitones / 12)
}

export function formatKeyShift(semitones: number): string {
  if (semitones > 0) return `+${semitones}`
  if (semitones < 0) return `−${Math.abs(semitones)}`
  return '0'
}

/** 'G' +2 → 'A'. Flats are read; the answer uses the app's sharp names. */
export function transposeKeyName(keyName: string, semitones: number): string {
  const offset = KEY_OFFSETS[keyName]
  if (offset === undefined) return keyName
  const index = (((offset + Math.round(semitones)) % 12) + 12) % 12
  return NOTE_NAMES[index] ?? keyName
}

// Each of these returns the same array at 0, so memos downstream stay put.

export function transposeNotes<T extends { midi: number }>(
  notes: T[],
  semitones: number,
): T[] {
  if (semitones === 0) return notes
  return notes.map((note) => ({ ...note, midi: note.midi + semitones }))
}

/** A pitch contour; the name and octave follow the moved frequency. */
export function transposePitchReadings<
  T extends { frequency: number; noteName: string; octave: number },
>(readings: T[], semitones: number): T[] {
  if (semitones === 0) return readings
  const ratio = pitchRatio(semitones)
  return readings.map((reading) => {
    const frequency = reading.frequency * ratio
    const { name, octave } = midiToNote(freqToMidiFloat(frequency))
    return { ...reading, frequency, noteName: name, octave }
  })
}

/** Notes named for display, "E4" or "E"; the name keeps its own format. */
export function transposeNamedNotes<
  T extends { midi: number | null; noteName: string | null },
>(notes: T[], semitones: number): T[] {
  if (semitones === 0) return notes
  return notes.map((note) => {
    if (note.midi === null) return note
    const midi = note.midi + semitones
    const { name, octave } = midiToNote(midi)
    const withOctave = note.noteName !== null && /\d$/.test(note.noteName)
    const noteName =
      note.noteName === null ? null : withOctave ? `${name}${octave}` : name
    return { ...note, midi, noteName }
  })
}
