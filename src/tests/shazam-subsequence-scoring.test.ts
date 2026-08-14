// ============================================================
// Subsequence scoring — the Mercury Sing case, measured
// ============================================================
//
// Someone sings a short phrase; the reference is a whole song. Every
// assertion here failed before the matcher was fixed, and each failure was
// silent — no error, just a song that could never be found or never be
// certain enough to open.

import { beforeEach, describe, expect, it } from 'vitest'
import { addStemFingerprint, removeStemFingerprint, } from '@/lib/shazam/melody-fingerprints'
import { matchPitchContour } from '@/lib/shazam/melody-matcher'
import type { LivePitchContour, MelodyFingerprint } from '@/lib/shazam/types'

const NOTE_SEC = 0.5

/** A song whose every window is unique — a repeating scale would match
 *  anywhere and prove nothing about offsets. */
function makeSong(noteCount: number, id = 'probe'): MelodyFingerprint {
  const pitchSequence: number[] = []
  const chromaSequence: number[] = []
  const intervalSequence: number[] = []
  const ioiSequence: number[] = []
  const durations: number[] = []
  let seed = 12345
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  let cur = 60
  for (let i = 0; i < noteCount; i++) {
    cur = Math.max(48, Math.min(79, cur + Math.round((rand() - 0.5) * 8)))
    pitchSequence.push(cur)
    chromaSequence.push(cur % 12)
    durations.push(NOTE_SEC * 0.8)
    if (i > 0) {
      intervalSequence.push(cur - pitchSequence[i - 1])
      ioiSequence.push(NOTE_SEC)
    }
  }
  return {
    melodyId: `stem:${id}`,
    name: 'Probe Song',
    pitchSequence,
    chromaSequence,
    intervalSequence,
    durations,
    ioiSequence,
    bpm: 120,
    key: 'C',
    durationSec: noteCount * NOTE_SEC,
    noteCount,
    firstNoteStartSec: 0,
  } as MelodyFingerprint
}

/** An exact excerpt of the song, as the singer would deliver it. */
function excerpt(
  song: MelodyFingerprint,
  start: number,
  len: number,
): LivePitchContour {
  const noteSequence = song.pitchSequence.slice(start, start + len)
  return {
    frames: [],
    onsets: [],
    durationSec: len * NOTE_SEC,
    noteSequence,
    ioiSequence: noteSequence.slice(1).map(() => NOTE_SEC),
    noteDurations: noteSequence.map(() => NOTE_SEC * 0.8),
  } as LivePitchContour
}

const SONG_NOTES = 200
const START_NOTE = 48

let song: MelodyFingerprint

beforeEach(() => {
  removeStemFingerprint('probe')
  song = makeSong(SONG_NOTES)
  addStemFingerprint(song)
})

const topFor = (len: number) =>
  matchPitchContour(excerpt(song, START_NOTE, len), {
    sourceFilter: 'stem',
    maxResults: 3,
  })[0]

describe('a short phrase inside a long song', () => {
  // The note-ratio filter used to skip any reference more than 3x the
  // query when the query was under 20 notes — which is every short phrase
  // against every real song. Nothing matched at all.
  it.each([8, 12, 19, 20, 40])('is found when %i notes are sung', (len) => {
    const top = topFor(len)
    expect(top).toBeDefined()
    expect(top.confidence).toBeGreaterThan(90)
  })

  it('can reach the certainty an auto-open needs', () => {
    // The length bonus compared the query against the WHOLE song, capping
    // a flawless excerpt at ~91% — under the 95% threshold Mercury Sing
    // shipped with, so the band could never join in on its own.
    expect(topFor(25).confidence).toBeGreaterThanOrEqual(95)
  })

  it('reports where in the song the phrase starts', () => {
    const top = topFor(25)
    expect(top.matchOffsetSec).toBeCloseTo(START_NOTE * NOTE_SEC, 1)
  })

  it('does not mistake a different melody for a match', () => {
    const wrong: LivePitchContour = {
      ...excerpt(song, START_NOTE, 25),
      noteSequence: [
        64, 59, 71, 53, 67, 62, 55, 74, 60, 69, 51, 66, 58, 72, 63, 56, 70, 61,
        75, 54, 68, 57, 73, 52, 65,
      ],
    } as LivePitchContour
    const top = matchPitchContour(wrong, { sourceFilter: 'stem' })[0]
    expect(top.confidence).toBeLessThan(60)
  })
})

describe('rhythm actually carries information', () => {
  it('separates the right rhythm from a wrong one', () => {
    // IOIs used to be normalised by TOTAL duration, so a short query's
    // gaps and a long song's gaps landed on different scales and every
    // value collapsed toward zero. Measured before the fix: a deliberately
    // wrong rhythm scored 0.946 against a correct 0.970 — indistinguishable.
    const right = topFor(25).breakdown.rhythmScore
    const q = excerpt(song, START_NOTE, 25)
    const wrongRhythm: LivePitchContour = {
      ...q,
      ioiSequence: q.ioiSequence.map((_, i) => (i % 2 === 0 ? 0.12 : 1.4)),
    } as LivePitchContour
    const wrong = matchPitchContour(wrongRhythm, { sourceFilter: 'stem' })[0]
      .breakdown.rhythmScore
    expect(right).toBeGreaterThan(0.9)
    expect(right - wrong).toBeGreaterThan(0.2)
  })
})

describe('short queries still cannot claim certainty', () => {
  it('rates a two-note query well below a sung phrase', () => {
    const two = matchPitchContour(excerpt(song, START_NOTE, 2), {
      sourceFilter: 'stem',
    })[0]
    expect(two.confidence).toBeLessThan(90)
  })
})

describe('reference boundaries', () => {
  // Every case above probes an interior offset; a row-0 or open-end
  // off-by-one in the subsequence DTW would pass all of them and only
  // bite on a singer starting at the very first line or the outro.
  it('finds a phrase at the very START of the song, offset 0', () => {
    const top = matchPitchContour(excerpt(song, 0, 25), {
      sourceFilter: 'stem',
    })[0]
    expect(top.confidence).toBeGreaterThanOrEqual(95)
    expect(top.matchOffsetSec).toBeCloseTo(0, 1)
  })

  it('finds a phrase ending on the very LAST note', () => {
    const len = 25
    const start = SONG_NOTES - len
    const top = matchPitchContour(excerpt(song, start, len), {
      sourceFilter: 'stem',
    })[0]
    expect(top.confidence).toBeGreaterThanOrEqual(95)
    expect(top.matchOffsetSec).toBeCloseTo(start * NOTE_SEC, 1)
  })
})
