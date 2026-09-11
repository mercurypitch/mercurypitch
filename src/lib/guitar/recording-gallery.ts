// Compact gallery evidence describes captured notes without decoding or loading recorded audio.
import type { GuitarRecordedNote } from './recording-types'

export interface GuitarRecordingPreview {
  noteCount: number
  lowestMidi: number | null
  highestMidi: number | null
  marks: Array<{ x: number; y: number; width: number }>
}

export function createRecordingPreview(
  notes: readonly GuitarRecordedNote[],
  frames: number,
): GuitarRecordingPreview {
  if (
    !Array.isArray(notes) ||
    notes.length > 10000 ||
    !Number.isFinite(frames) ||
    frames < 0 ||
    notes.some(
      (note) =>
        !Number.isInteger(note.midi) ||
        note.midi < 0 ||
        note.midi > 127 ||
        !Number.isFinite(note.startFrame) ||
        !Number.isFinite(note.endFrame) ||
        note.startFrame < 0 ||
        note.endFrame <= note.startFrame ||
        note.endFrame > frames,
    )
  )
    throw new Error(
      'This recording has damaged note evidence. Open Review to check the saved take.',
    )
  if (!notes.length)
    return { noteCount: 0, lowestMidi: null, highestMidi: null, marks: [] }
  const pitches = notes.map((note) => note.midi)
  const lowestMidi = Math.min(...pitches)
  const highestMidi = Math.max(...pitches)
  // Bounded drawing, not quantization: sample the overview, keep the real count
  // and pitch range. Raw timing and all recorded notes remain untouched.
  const length = Math.min(96, notes.length)
  const marks = Array.from({ length }, (_, index) => {
    const note =
      notes[Math.floor((index * (notes.length - 1)) / Math.max(1, length - 1))]
    return {
      x: 4 + (note.startFrame / frames) * 92,
      y:
        highestMidi === lowestMidi
          ? 24
          : 10 + ((highestMidi - note.midi) / (highestMidi - lowestMidi)) * 28,
      width: Math.max(0.5, ((note.endFrame - note.startFrame) / frames) * 92),
    }
  })
  return { noteCount: notes.length, lowestMidi, highestMidi, marks }
}
