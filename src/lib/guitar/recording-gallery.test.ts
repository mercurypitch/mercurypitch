// Gallery marks are bounded read-only evidence, never a quantized practice target.
import { describe, expect, it } from 'vitest'
import { createRecordingPreview } from './recording-gallery'
import type { GuitarRecordedNote } from './recording-types'

const note = (index: number): GuitarRecordedNote => ({
  id: String(index),
  midi: 40 + (index % 24),
  startFrame: index * 400 + 17,
  endFrame: index * 400 + 199,
  clarity: 0.9,
  onset: 'attack',
})

describe('recording gallery evidence', () => {
  it('keeps real note counts and range while bounding drawing work', () => {
    const notes = Array.from({ length: 400 }, (_, i) => note(i))
    const before = structuredClone(notes)
    const preview = createRecordingPreview(notes, 160000)
    expect(preview.noteCount).toBe(400)
    expect(preview.marks).toHaveLength(96)
    expect(preview.lowestMidi).toBe(40)
    expect(preview.highestMidi).toBe(63)
    expect(preview.marks[0].x).toBeCloseTo(4 + (17 / 160000) * 92)
    expect(preview.marks.at(-1)?.x).toBeCloseTo(
      4 + (notes.at(-1)!.startFrame / 160000) * 92,
    )
    expect(notes).toEqual(before)
  })
  it('distinguishes a true empty melody from damaged evidence', () => {
    expect(createRecordingPreview([], 0)).toEqual({
      noteCount: 0,
      lowestMidi: null,
      highestMidi: null,
      marks: [],
    })
    expect(() =>
      createRecordingPreview([{ ...note(0), endFrame: 2000 }], 1000),
    ).toThrow('damaged')
    expect(() =>
      createRecordingPreview([{ ...note(0), midi: NaN }], 1000),
    ).toThrow('damaged')
  })
})
