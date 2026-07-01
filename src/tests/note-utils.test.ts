import { describe, expect, it } from 'vitest'
import { midiToNoteName, midiToNoteNameOctave, noteColor, } from '@/lib/note-utils'

describe('midiToNoteName', () => {
  it('converts MIDI 60 to C', () => {
    expect(midiToNoteName(60)).toBe('C')
  })

  it('does not return undefined for negative MIDI values', () => {
    // -1 % 12 === -1 in JS, which used to index NOTE_NAMES[-1] === undefined
    expect(midiToNoteName(-1)).toBe('B')
    expect(midiToNoteName(-12)).toBe('C')
  })
})

describe('midiToNoteNameOctave', () => {
  it('converts MIDI 60 to C4', () => {
    expect(midiToNoteNameOctave(60)).toBe('C4')
  })

  it('does not produce "undefined" for negative MIDI values', () => {
    expect(midiToNoteNameOctave(-1)).toBe('B-2')
    expect(midiToNoteNameOctave(-13)).toBe('B-3')
  })
})

describe('noteColor', () => {
  it('returns a defined color for negative MIDI values', () => {
    // Previously this fell through to the '#8b949e' fallback because
    // midiToNoteName(-1) returned "undefined", which isn't a NOTE_COLORS key.
    expect(noteColor(-1)).toBe('#8bc34a') // B
  })
})
