import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'

const KEY = 'pitchperfect_long_note_lantern_note'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

const load = () => import('./remembered-note')

describe('remembered-note', () => {
  it('keeps the last note held, and whether the singer chose it', async () => {
    const { chosenLongNote, rememberedLongNote, rememberLongNote } =
      await load()
    rememberLongNote(57, true)
    rememberLongNote(60, false)
    expect(rememberedLongNote()).toBe(60)
    expect(chosenLongNote()).toBeNull()

    rememberLongNote(62, true)
    expect(rememberedLongNote()).toBe(62)
    expect(chosenLongNote()).toBe(62)
  })

  it('ignores a note the room cannot offer', async () => {
    const { rememberedLongNote, rememberLongNote } = await load()
    rememberLongNote(60, true)
    rememberLongNote(HOLD_TARGET_MAX_MIDI + 1, true)
    rememberLongNote(HOLD_TARGET_MIN_MIDI - 1, true)
    rememberLongNote(60.5, true)
    expect(rememberedLongNote()).toBe(60)
  })

  it('reads a note kept before choices were, as held but not chosen', async () => {
    localStorage.setItem(KEY, JSON.stringify(53))
    const { chosenLongNote, rememberedLongNote } = await load()
    expect(rememberedLongNote()).toBe(53)
    expect(chosenLongNote()).toBeNull()
  })

  it('drops a stored value it cannot read', async () => {
    localStorage.setItem(KEY, JSON.stringify({ midi: 53 }))
    const { rememberedLongNote } = await load()
    expect(rememberedLongNote()).toBeNull()
  })
})
