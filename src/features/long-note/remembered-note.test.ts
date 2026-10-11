import { describe, expect, it } from 'vitest'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { rememberedLongNote, rememberLongNote } from './remembered-note'

describe('remembered-note', () => {
  it('keeps the last note held', () => {
    rememberLongNote(57)
    rememberLongNote(60)
    expect(rememberedLongNote()).toBe(60)
  })

  it('ignores a note the room cannot offer', () => {
    rememberLongNote(60)
    rememberLongNote(HOLD_TARGET_MAX_MIDI + 1)
    rememberLongNote(HOLD_TARGET_MIN_MIDI - 1)
    rememberLongNote(60.5)
    expect(rememberedLongNote()).toBe(60)
  })
})
