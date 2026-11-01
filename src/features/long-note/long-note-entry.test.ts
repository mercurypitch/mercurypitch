// ============================================================
// Long note, as the Sing screen's way in describes it
// ============================================================
//
// The exercise row and the picker print the note Long note opens on, its
// best in the result card's own format, and whether its demo plays by
// itself. Each answer is read from the room's own stores, so the module is
// loaded fresh over a seeded storage for every case.

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Seed {
  note?: number
  bests?: Record<
    string,
    { inBandSeconds: number; steadiness: number; at: number }
  >
  demoSeen?: boolean
}

beforeEach(() => {
  localStorage.clear()
  vi.doUnmock('@/lib/hold/load-hold-target')
  vi.resetModules()
})

async function load(seed: Seed = {}) {
  if (seed.note !== undefined) {
    localStorage.setItem(
      'pitchperfect_long_note_lantern_note',
      JSON.stringify(seed.note),
    )
  }
  if (seed.bests !== undefined) {
    localStorage.setItem(
      'pitchperfect_long_note_lantern_bests',
      JSON.stringify(seed.bests),
    )
  }
  if (seed.demoSeen !== undefined) {
    localStorage.setItem(
      'mp_long_note_demo_seen',
      JSON.stringify(seed.demoSeen),
    )
  }
  return import('./long-note-entry')
}

const best = (inBandSeconds: number) => ({
  inBandSeconds,
  steadiness: 80,
  at: 1,
})

describe('formatHoldSeconds', () => {
  it('floors to the tenth the result card shows, never rounds up', async () => {
    const { formatHoldSeconds } = await load()

    expect(formatHoldSeconds(9.46)).toBe('9.4 s')
    expect(formatHoldSeconds(9.99)).toBe('9.9 s')
    expect(formatHoldSeconds(12)).toBe('12.0 s')
  })
})

describe('the note Long note opens on', () => {
  it('is the note held last time, by name', async () => {
    const { longNoteEntry } = await load({ note: 57 })

    expect(longNoteEntry().note()).toBe('A3')
  })

  it('is no note before the first result', async () => {
    const { longNoteEntry } = await load()

    expect(longNoteEntry().note()).toBeNull()
  })

  it("is the room's own: the voiceprint's pick over a note only accepted", async () => {
    vi.doMock('@/lib/hold/load-hold-target', () => ({
      loadHoldTarget: () => ({ midi: 59, source: 'voiceprint' }),
    }))
    const { longNoteEntry } = await load({ note: 53 })

    expect(longNoteEntry().note()).toBe('B3')
  })
})

describe('the best Long note shows for that note', () => {
  it('is the best on the remembered note, floored as the card prints it', async () => {
    const { longNoteEntry } = await load({
      note: 57,
      bests: { 57: best(9.46) },
    })

    expect(longNoteEntry().progress()).toBe('Best 9.4 s')
  })

  it('is nothing when that note has no best, whatever other notes have', async () => {
    const { longNoteEntry } = await load({ note: 57, bests: { 60: best(14) } })

    expect(longNoteEntry().progress()).toBeNull()
  })

  it('is nothing with no note remembered', async () => {
    const { longNoteEntry } = await load({ bests: { 57: best(9.46) } })

    expect(longNoteEntry().progress()).toBeNull()
  })

  it('follows a new best on a new note without being asked for again', async () => {
    const { longNoteEntry } = await load({
      note: 57,
      bests: { 57: best(9.46) },
    })
    const entry = longNoteEntry()
    const { recordLongNoteBest } = await import('./long-note-best')
    const { rememberLongNote } = await import('./remembered-note')

    recordLongNoteBest(60, best(13.21))
    rememberLongNote(60, true)

    expect(entry.note()).toBe('C4')
    expect(entry.progress()).toBe('Best 13.2 s')
  })
})

describe('whether the demo plays by itself', () => {
  it.each([
    { seen: false, note: undefined, plays: true },
    { seen: false, note: 57, plays: false },
    { seen: true, note: undefined, plays: false },
    { seen: true, note: 57, plays: false },
  ])(
    'seen $seen, note $note: plays by itself $plays',
    async ({ seen, note, plays }) => {
      const { longNoteEntry } = await load({ demoSeen: seen, note })

      expect(longNoteEntry().demoAutoPlays()).toBe(plays)
    },
  )
})
