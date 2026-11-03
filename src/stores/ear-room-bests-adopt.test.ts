// ============================================================
// The Ear rooms' stores adopt the bests a device kept before they synced
// ============================================================
//
// Until 3 Nov 2026 each Ear room kept its bests on the device only, under
// an `mp_` key. Each store reads its synced table (`pitchperfect_`) and, on
// its first read, merges the old table into it and lets the old key go, so
// a phone loses nothing it sang and the account learns it.

import { beforeEach, describe, expect, it } from 'vitest'
import { firstNoteBest, resetFirstNoteStoreForTests } from './first-note-store'
import { harmonyBest, resetHarmonyStoreForTests } from './harmony-store'
import { homeNoteBest, resetHomeNoteStoreForTests } from './home-note-store'
import { leapBest, resetLeapStoreForTests } from './leap-store'

const ROOMS = [
  {
    name: 'Home note',
    synced: 'pitchperfect_home_note_bests',
    old: 'mp_home_note_bests',
    best: (score: number) => ({ found: score, rounds: 6, seconds: 1, at: 1 }),
    read: homeNoteBest,
    reset: resetHomeNoteStoreForTests,
  },
  {
    name: 'First note',
    synced: 'pitchperfect_first_note_bests',
    old: 'mp_first_note_bests',
    best: (score: number) => ({
      onNote: score,
      found: score,
      rounds: 6,
      cents: 20,
      at: 1,
    }),
    read: firstNoteBest,
    reset: resetFirstNoteStoreForTests,
  },
  {
    name: 'Leap',
    synced: 'pitchperfect_leap_bests',
    old: 'mp_leap_bests',
    best: (score: number) => ({ landed: score, rounds: 8, seconds: 1, at: 1 }),
    read: leapBest,
    reset: resetLeapStoreForTests,
  },
  {
    name: 'Harmony',
    synced: 'pitchperfect_harmony_bests',
    old: 'mp_harmony_bests',
    best: (score: number) => ({
      inHarmony: score,
      lines: 6,
      notesLanded: score * 5,
      notes: 30,
      at: 1,
    }),
    read: harmonyBest,
    reset: resetHarmonyStoreForTests,
  },
] as const

describe.each(ROOMS)("$name's bests", (room) => {
  beforeEach(() => {
    localStorage.clear()
    room.reset()
  })

  it('adopts the table this device kept, into the table that syncs, once', () => {
    localStorage.setItem(room.old, JSON.stringify({ singer: room.best(5) }))
    expect(room.read('singer')).toEqual(room.best(5))
    expect(JSON.parse(localStorage.getItem(room.synced) ?? '{}')).toEqual({
      singer: room.best(5),
    })
    expect(localStorage.getItem(room.old)).toBeNull()
  })

  it('keeps the better best where the synced table already has the level', () => {
    localStorage.setItem(room.synced, JSON.stringify({ singer: room.best(3) }))
    localStorage.setItem(
      room.old,
      JSON.stringify({ singer: room.best(2), learning: room.best(4) }),
    )
    expect(room.read('singer')).toEqual(room.best(3))
    expect(room.read('learning')).toEqual(room.best(4))
    expect(localStorage.getItem(room.old)).toBeNull()
  })

  it('reads the synced table alone once the old key is gone', () => {
    localStorage.setItem(room.synced, JSON.stringify({ singer: room.best(4) }))
    expect(room.read('singer')).toEqual(room.best(4))
    expect(room.read('professional')).toBeNull()
  })
})
