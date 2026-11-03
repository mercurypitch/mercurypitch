// ============================================================
// The Ear rooms' bests: each room's rule, and its synced table
// ============================================================

import { describe, expect, it } from 'vitest'
import { EAR_ROOM_BESTS, FIRST_NOTE_BEST_RULES, FIRST_NOTE_DEVICE_BESTS_KEY, HARMONY_BEST_RULES, HARMONY_DEVICE_BESTS_KEY, HOME_NOTE_BEST_RULES, HOME_NOTE_DEVICE_BESTS_KEY, LEAP_BEST_RULES, LEAP_DEVICE_BESTS_KEY, mergeFirstNoteBestsOnPull, mergeHarmonyBestsOnPull, mergeHomeNoteBestsOnPull, mergeLeapBestsOnPull, } from './ear-room-bests'

describe("the Ear rooms' bests", () => {
  it('syncs each room under its own pitchperfect_ key, its old mp_ key kept apart', () => {
    const keys = EAR_ROOM_BESTS.map((room) => room.key)
    expect(keys).toEqual([
      'pitchperfect_home_note_bests',
      'pitchperfect_first_note_bests',
      'pitchperfect_leap_bests',
      'pitchperfect_harmony_bests',
    ])
    expect([
      HOME_NOTE_DEVICE_BESTS_KEY,
      FIRST_NOTE_DEVICE_BESTS_KEY,
      LEAP_DEVICE_BESTS_KEY,
      HARMONY_DEVICE_BESTS_KEY,
    ]).toEqual([
      'mp_home_note_bests',
      'mp_first_note_bests',
      'mp_leap_bests',
      'mp_harmony_bests',
    ])
  })

  it("keeps Home note's better best: more found, then quicker", () => {
    const run = (found: number, seconds: number, at: number) => ({
      found,
      rounds: 6,
      seconds,
      at,
    })
    expect(HOME_NOTE_BEST_RULES.beats(run(5, 3, 1), run(4, 1, 2))).toBe(true)
    const merged = mergeHomeNoteBestsOnPull(
      JSON.stringify({ singer: run(4, 1.5, 1) }),
      JSON.stringify({ singer: run(4, 2, 2), learning: run(6, 1, 3) }),
    )
    expect(JSON.parse(merged)).toEqual({
      singer: run(4, 1.5, 1),
      learning: run(6, 1, 3),
    })
  })

  it("keeps First note's better best: more on the note, then found, then closer", () => {
    const run = (onNote: number, found: number, cents: number, at: number) => ({
      onNote,
      found,
      rounds: 6,
      cents,
      at,
    })
    expect(FIRST_NOTE_BEST_RULES.beats(run(3, 4, 30, 1), run(2, 6, 5, 2))).toBe(
      true,
    )
    const local = JSON.stringify({ singer: run(3, 4, 40, 1) })
    const cloud = JSON.stringify({ singer: run(3, 4, 20, 2) })
    expect(mergeFirstNoteBestsOnPull(local, cloud)).toBe(cloud)
  })

  it("keeps Leap's better best: more landed, then quicker", () => {
    const run = (landed: number, seconds: number, at: number) => ({
      landed,
      rounds: 8,
      seconds,
      at,
    })
    expect(LEAP_BEST_RULES.beats(run(6, 2, 1), run(5, 1, 2))).toBe(true)
    const local = JSON.stringify({ professional: run(7, 1.2, 1) })
    const cloud = JSON.stringify({ professional: run(6, 0.9, 2) })
    expect(mergeLeapBestsOnPull(local, cloud)).toBe(local)
  })

  it("keeps Harmony's better best: more lines in harmony, then more notes", () => {
    const run = (inHarmony: number, notesLanded: number, at: number) => ({
      inHarmony,
      lines: 6,
      notesLanded,
      notes: 30,
      at,
    })
    expect(HARMONY_BEST_RULES.beats(run(4, 20, 1), run(3, 25, 2))).toBe(true)
    const local = JSON.stringify({ singer: run(4, 20, 1) })
    const cloud = JSON.stringify({ singer: run(4, 22, 2) })
    expect(mergeHarmonyBestsOnPull(local, cloud)).toBe(cloud)
  })

  it('reads no table with a best that breaks its room’s counts', () => {
    expect(
      HOME_NOTE_BEST_RULES.isBest({ found: 7, rounds: 6, seconds: 1, at: 1 }),
    ).toBe(false)
    expect(
      HARMONY_BEST_RULES.isBest({
        inHarmony: 1,
        lines: 6,
        notesLanded: 40,
        notes: 30,
        at: 1,
      }),
    ).toBe(false)
  })
})
