// ============================================================
// What First note's stage shows: the countdown, the line, the chip
// ============================================================

import { describe, expect, it } from 'vitest'
import type { FirstNoteEntry } from './first-note-songs'
import { countdownAt, entryChip, lineShows, sameCountdown, } from './first-note-stage'

/** An entry eight seconds in, its last four beats counted. */
const ENTRY: FirstNoteEntry = {
  at: 11.69,
  midi: 52,
  from: 3.69,
  until: 15.69,
  beats: [9.181, 9.887, 10.593, 11.299],
  words: "I'll be right behind you, Josephine",
}

describe("First note's countdown", () => {
  it('runs from the lead-in to the entry, held at both ends', () => {
    expect(countdownAt(ENTRY, 0)).toEqual({ progress: 0, beats: 4, lit: 0 })
    expect(countdownAt(ENTRY, 7.69).progress).toBeCloseTo(0.5, 9)
    expect(countdownAt(ENTRY, 20)).toEqual({ progress: 1, beats: 4, lit: 4 })
  })

  it('lights each beat as the band reaches it', () => {
    expect(countdownAt(ENTRY, 9.18).lit).toBe(0)
    expect(countdownAt(ENTRY, 9.181).lit).toBe(1)
    expect(countdownAt(ENTRY, 10.6).lit).toBe(3)
    expect(countdownAt(ENTRY, 11.3).lit).toBe(4)
  })

  it('counts nothing for an entry with no beats, and no span', () => {
    const bare = { ...ENTRY, beats: [], from: ENTRY.at }
    expect(countdownAt(bare, 11)).toEqual({ progress: 0, beats: 0, lit: 0 })
  })

  it('draws again only for a beat or a step the eye can see', () => {
    const shown = countdownAt(ENTRY, 5)
    expect(sameCountdown(null, shown)).toBe(false)
    expect(sameCountdown(shown, countdownAt(ENTRY, 5.01))).toBe(true)
    expect(sameCountdown(shown, countdownAt(ENTRY, 5.2))).toBe(false)
    const beat = countdownAt(ENTRY, 9.181)
    expect(sameCountdown(countdownAt(ENTRY, 9.18), beat)).toBe(false)
  })
})

describe("First note's line", () => {
  it('shows by the level in the turn, and always once the round is over', () => {
    expect(lineShows('always', 'band', false)).toBe(true)
    expect(lineShows('afterEntry', 'band', false)).toBe(false)
    expect(lineShows('afterEntry', 'sing', false)).toBe(false)
    expect(lineShows('afterEntry', 'sing', true)).toBe(true)
    expect(lineShows('onLanding', 'sing', true)).toBe(false)
    expect(lineShows('onLanding', 'landed', true)).toBe(true)
    expect(lineShows('afterEntry', 'missed', false)).toBe(true)
    expect(lineShows('always', 'intro', false)).toBe(false)
    expect(lineShows('always', 'result', false)).toBe(false)
  })
})

describe("First note's chip once the singer has come in", () => {
  it('says on the note, or which way it was off', () => {
    expect(entryChip({ cents: 4, onNote: true })).toBe('On the note')
    expect(entryChip({ cents: -180, onNote: false })).toBe('Came in low')
    expect(entryChip({ cents: 90, onNote: false })).toBe('Came in high')
  })
})
