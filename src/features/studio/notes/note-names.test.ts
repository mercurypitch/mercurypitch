// Studio note names tests — a pitch is named with its octave, middle C as C4, a sharp as a sharp sign, down to the keyboard's lowest note.
import { describe, expect, it } from 'vitest'
import { studioNoteName } from './note-names'

describe('studioNoteName', () => {
  it('names a pitch with its octave, middle C as C4 and a sharp as a sharp sign', () => {
    expect(studioNoteName(60)).toBe('C4')
    expect(studioNoteName(54)).toBe('F♯3')
    expect(studioNoteName(127)).toBe('G9')
    expect(studioNoteName(0)).toBe('C-1')
  })
})
