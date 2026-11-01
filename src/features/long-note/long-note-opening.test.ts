import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HoldTarget } from '@/lib/hold/hold-target'

const KEY = 'pitchperfect_long_note_lantern_note'
const VOICEPRINT: HoldTarget = { midi: 55, source: 'voiceprint' }
const PRESET: HoldTarget = { midi: 57, source: 'preset' }

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

async function load(stored?: unknown) {
  if (stored !== undefined) localStorage.setItem(KEY, JSON.stringify(stored))
  return import('./long-note-opening')
}

describe('the note Long note opens on', () => {
  it("is the singer's chosen note before the voiceprint's pick", async () => {
    const { longNoteOpening } = await load({ midi: 60, chosen: true })
    expect(longNoteOpening(VOICEPRINT, 50)).toBe(60)
  })

  it("is the voiceprint's pick over a note only accepted, so a moved pick moves the room", async () => {
    const { longNoteOpening } = await load({ midi: 53, chosen: false })
    expect(longNoteOpening(VOICEPRINT, 50)).toBe(55)
  })

  it("is the voiceprint's pick over a note kept before choices were (the owner's F3)", async () => {
    const { longNoteOpening } = await load(53)
    expect(longNoteOpening(VOICEPRINT)).toBe(55)
  })

  it('is the note held last time with no voiceprint, else the Warm-up’s', async () => {
    const held = await load(53)
    expect(held.longNoteOpening(PRESET, 50)).toBe(53)

    vi.resetModules()
    localStorage.clear()
    const fresh = await load()
    expect(fresh.longNoteOpening(PRESET, 50)).toBe(50)
    expect(fresh.longNoteOpening(PRESET)).toBeNull()
  })
})

describe('whether a held note was chosen', () => {
  it("is not for the voiceprint's pick held as offered", async () => {
    const { heldNoteChosen } = await load()
    expect(heldNoteChosen(55, VOICEPRINT)).toBe(false)
  })

  it('is for a note moved off the pick, and for any note without a voiceprint', async () => {
    const { heldNoteChosen } = await load()
    expect(heldNoteChosen(57, VOICEPRINT)).toBe(true)
    expect(heldNoteChosen(57, PRESET)).toBe(true)
  })
})
