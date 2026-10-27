import { describe, expect, it } from 'vitest'
import { ENTRIES_PER_SONG, FIRST_NOTE_ROUNDS } from './first-note-rules'
import type { FirstNoteSong } from './first-note-songs'
import { FIRST_NOTE_SONGS, LINE_SHARES, pickEntries, planRun, } from './first-note-songs'

/** A seeded random source, the same run every time. */
function seeded(seed = 7): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const SONG: FirstNoteSong = {
  slug: 'test-song',
  title: 'Test Song',
  artist: 'Someone',
  credit: 'Someone · CC BY 4.0',
  stems: { vocal: '/v.m4a', instrumental: '/i.m4a' },
  entries: [
    { at: 10, midi: 52, from: 2, until: 15, beats: [] },
    { at: 20, midi: 52, from: 12, until: 25, beats: [] },
    { at: 30, midi: 54, from: 22, until: 35, beats: [] },
  ],
}

describe("First note's songs", () => {
  it('carries the three example songs, each credited as its licence asks', () => {
    expect(FIRST_NOTE_SONGS.map((song) => song.title)).toEqual([
      'Goodbye to Spring',
      "I'll Be Right Behind You, Josephine",
      'Nothing in the Dark',
    ])
    for (const song of FIRST_NOTE_SONGS) {
      expect(song.credit).toBe('Josh Woodward · CC BY 4.0')
      expect(song.entries.length).toBeGreaterThanOrEqual(ENTRIES_PER_SONG)
    }
  })

  it("picks a song's entries on different notes first, in the song's order", () => {
    for (let seed = 1; seed < 40; seed++) {
      const picks = pickEntries(SONG, 2, seeded(seed))
      expect(new Set(picks.map((pick) => pick.midi)).size).toBe(2)
      expect(picks[0].at).toBeLessThan(picks[1].at)
    }
  })

  it('plans a run of two entries from each song, a song at a time', () => {
    const rounds = planRun(FIRST_NOTE_SONGS, seeded())
    expect(rounds).toHaveLength(FIRST_NOTE_ROUNDS)
    expect(rounds.map((round) => round.index)).toEqual([0, 1, 2, 3, 4, 5])
    const slugs = rounds.map((round) => round.song.slug)
    expect(new Set(slugs).size).toBe(3)
    // Each song's two entries sit together, in the song's order.
    for (let i = 0; i < rounds.length; i += 2) {
      expect(slugs[i]).toBe(slugs[i + 1])
      expect(rounds[i].entry.at).toBeLessThan(rounds[i + 1].entry.at)
    }
  })

  it("places each round's line somewhere new, inside the stage's range", () => {
    const rounds = planRun(FIRST_NOTE_SONGS, seeded(3))
    for (const round of rounds) {
      expect(round.lineShare).toBeGreaterThanOrEqual(LINE_SHARES.low)
      expect(round.lineShare).toBeLessThanOrEqual(LINE_SHARES.high)
    }
    expect(new Set(rounds.map((round) => round.lineShare)).size).toBe(6)
  })
})
