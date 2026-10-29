import { describe, expect, it } from 'vitest'
import { ENTRIES_PER_SONG, FIRST_NOTE_ROUNDS } from './first-note-rules'
import type { FirstNoteSong } from './first-note-songs'
import { entryPitch, FIRST_NOTE_SONGS, LINE_SHARES, pickEntries, planRun, shareRun, SING_ON_LEAD_SEC, singOnFrom, songsOfRun, } from './first-note-songs'

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
  sessionId: 'test-song',
  kind: 'yours',
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

  it('names each example by the session the Karaoke room plays it under', () => {
    expect(FIRST_NOTE_SONGS.map((song) => song.sessionId)).toEqual([
      'karaoke-night-demo',
      'karaoke-night-demo:josephine',
      'karaoke-night-demo:nothing-in-the-dark',
    ])
    expect(FIRST_NOTE_SONGS.every((song) => song.kind === 'example')).toBe(true)
  })

  it('carries the words of the line each example entry comes in on', () => {
    for (const song of FIRST_NOTE_SONGS) {
      for (const entry of song.entries) {
        expect(entry.words, `${song.slug} at ${entry.at}`).toMatch(/\w/u)
        // The word timings are out of them.
        expect(entry.words).not.toMatch(/\[\d+:\d+/u)
      }
    }
    expect(FIRST_NOTE_SONGS[1].entries[0].words).toBe(
      "I'll be right behind you, Josephine",
    )
  })

  it('shares a run out over any songs, one entry each in turn', () => {
    const song = (id: string, entries: number): FirstNoteSong => ({
      ...SONG,
      slug: id,
      sessionId: id,
      entries: Array.from({ length: entries }, (_, i) => ({
        at: 10 + i * 10,
        midi: 50 + i,
        from: 2 + i * 10,
        until: 15 + i * 10,
        beats: [],
      })),
    })
    // Three songs give two each; four give two, two, one and one.
    expect(shareRun([song('a', 5), song('b', 5), song('c', 5)], 6)).toEqual([
      2, 2, 2,
    ])
    expect(
      shareRun([song('a', 5), song('b', 5), song('c', 5), song('d', 5)], 6),
    ).toEqual([2, 2, 1, 1])
    // One song gives what it has, up to the run.
    expect(shareRun([song('a', 4)], 6)).toEqual([4])
    expect(shareRun([song('a', 9)], 6)).toEqual([6])
    // Seven songs: one each to the first six.
    expect(
      shareRun(
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => song(id, 3)),
        6,
      ),
    ).toEqual([1, 1, 1, 1, 1, 1, 0])
    // A song short of entries passes its turn to the others.
    expect(shareRun([song('a', 1), song('b', 9)], 6)).toEqual([1, 5])

    const rounds = planRun([song('mine', 9)], seeded(5))
    expect(rounds).toHaveLength(FIRST_NOTE_ROUNDS)
    expect(new Set(rounds.map((round) => round.entry.at)).size).toBe(6)
    expect(songsOfRun(rounds).map((one) => one.slug)).toEqual(['mine'])
  })

  it('sings on in Karaoke from the first beat counted, or a breath before the entry', () => {
    const counted = { ...SONG.entries[0], beats: [6.4, 7.1, 7.8, 8.5] }
    expect(singOnFrom(counted)).toBe(6.4)
    expect(singOnFrom({ ...SONG.entries[0], at: 20, beats: [] })).toBe(
      20 - SING_ON_LEAD_SEC,
    )
    // Never before the song starts.
    expect(singOnFrom({ ...SONG.entries[0], at: 1.2, beats: [] })).toBe(0)
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

describe("an entry's pitch", () => {
  it("is its note as the band plays it: in tune with A440, or its song's tuning out", () => {
    const entry = { at: 10, midi: 57, from: 2, until: 14, beats: [] }
    expect(entryPitch(entry)).toBe(57)
    expect(entryPitch({ ...entry, cents: 35 })).toBeCloseTo(57.35, 10)
    expect(entryPitch({ ...entry, cents: -20 })).toBeCloseTo(56.8, 10)
  })
})
