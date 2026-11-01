// ============================================================
// A song found by singing, from the notes its analysis saved
// ============================================================
//
// The example songs' saved notes (notes.json) made into fingerprints with
// fingerprintFromNotes, no audio decoded, and then sung back: a stretch of
// each song's own melody, an octave up as another voice would sing it,
// with the pitch a little off and the timing a little loose, run through
// the same onset detection and matcher the listening stage uses.

import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { addStemFingerprint } from './melody-fingerprints'
import { matchPitchContour } from './melody-matcher'
import { detectOnsets, segmentNotes } from './onset-detector'
import type { FingerprintNote } from './stem-fingerprinter'
import { fingerprintFromNotes } from './stem-fingerprinter'
import type { LivePitchContour, TimestampedPitch } from './types'

const EXAMPLES = 'apps/mercurypitch/native-only/karaoke/examples'
const SONGS = ['goodbye-to-spring', 'josephine', 'nothing-in-the-dark']

function notesOf(dir: string): FingerprintNote[] {
  const analysis = JSON.parse(
    readFileSync(`${EXAMPLES}/${dir}/notes.json`, 'utf8'),
  ) as { mergedNotes: FingerprintNote[] }
  return analysis.mergedNotes
}

/** A seeded generator, so the sung take is the same on every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const FRAME_SEC = 0.01

/**
 * A take of the notes from `fromSec` for `seconds`: frames every 10 ms,
 * moved by `shift` semitones (an octave up by default, as another voice
 * would sing it), each note up to 30 cents off and its start up to 40 ms
 * late.
 */
function sungTake(
  notes: readonly FingerprintNote[],
  fromSec: number,
  seconds: number,
  shift = 12,
  seed = 7,
): LivePitchContour {
  const random = seeded(seed)
  const sung = notes.filter(
    (n) => n.startSec >= fromSec && n.startSec < fromSec + seconds,
  )
  const frames: TimestampedPitch[] = []
  const end = fromSec + seconds
  let note = 0
  for (let t = fromSec; t < end; t += FRAME_SEC) {
    while (note < sung.length && sung[note].endSec <= t) note++
    const current = sung[note] as FingerprintNote | undefined
    const voiced =
      current !== undefined &&
      t >= current.startSec + 0.04 * random() &&
      t < current.endSec
    const midi = voiced ? current.midi + shift + (random() - 0.5) * 0.6 : 0
    const pitch: DetectedPitch = {
      frequency: voiced ? 440 * 2 ** ((midi - 69) / 12) : 0,
      clarity: voiced ? 0.9 : 0,
      noteName: '',
      octave: 0,
      cents: 0,
    }
    frames.push({ time: t - fromSec, pitch })
  }
  const onsets = detectOnsets(frames)
  const segmented = segmentNotes(frames, onsets)
  return {
    frames,
    onsets,
    durationSec: frames[frames.length - 1].time,
    noteSequence: segmented.noteSequence,
    ioiSequence: segmented.ioiSequence,
    noteDurations: segmented.noteDurations,
  }
}

beforeAll(() => {
  for (const dir of SONGS) {
    const fp = fingerprintFromNotes(notesOf(dir), {
      sessionId: dir,
      originalFileName: dir,
    })
    if ('reason' in fp) throw new Error(fp.reason)
    addStemFingerprint(fp)
  }
})

describe('fingerprintFromNotes', () => {
  it('needs a few notes to be a melody at all', () => {
    const fp = fingerprintFromNotes(
      [
        { midi: 60, startSec: 0, endSec: 0.5 },
        { midi: 62, startSec: 0.5, endSec: 1 },
      ],
      { sessionId: 's', originalFileName: 'Song' },
    )
    expect('reason' in fp).toBe(true)
  })

  it('keeps where the song starts singing, for the seek', () => {
    const fp = fingerprintFromNotes(notesOf('josephine'), {
      sessionId: 'josephine',
      originalFileName: 'Josephine',
    })
    expect('reason' in fp).toBe(false)
    if (!('reason' in fp)) {
      expect(fp.melodyId).toBe('stem:josephine')
      expect(fp.firstNoteStartSec).toBeCloseTo(
        notesOf('josephine')[0].startSec,
        6,
      )
    }
  })
})

describe('a song found by singing a stretch of it', () => {
  it.each([
    ['goodbye-to-spring', 47],
    ['josephine', 56],
    ['nothing-in-the-dark', 94],
  ])('finds %s from 12 s sung at %s s, and where', (dir, fromSec) => {
    const found = matchPitchContour(sungTake(notesOf(dir), fromSec, 12), {
      maxResults: 3,
      sourceFilter: 'stem',
    })

    expect(found[0]?.sessionId).toBe(dir)
    // Where the take's first note is in the song, so the room joins the
    // singer there: an octave up, it was once read off the absolute pitches
    // and landed on a later repeat of the same chorus.
    const first = notesOf(dir).find((n) => n.startSec >= fromSec)
    expect(Math.abs(found[0].matchOffsetSec! - first!.startSec)).toBeLessThan(
      2.5,
    )
  })
})

/**
 * Where each take is placed, over every fourth second of the three songs:
 * the share of takes of the right song placed within 2 s of where they
 * began. Measured with the matcher as it is, these floors sit under it.
 */
function placedWithin2s(shift: number): number {
  let near = 0
  let found = 0
  let seed = 11
  for (const dir of SONGS) {
    const notes = notesOf(dir)
    const last = notes[notes.length - 1].startSec
    for (let from = notes[0].startSec; from < last - 12; from += 4) {
      seed += 1
      const take = sungTake(notes, from, 12, shift, seed)
      if (take.noteSequence.length < 6) continue
      const top = matchPitchContour(take, {
        maxResults: 3,
        sourceFilter: 'stem',
      })[0]
      if (top?.sessionId !== dir || top.matchOffsetSec === undefined) continue
      found += 1
      const first = notes.find((n) => n.startSec >= from)!
      if (Math.abs(top.matchOffsetSec - first.startSec) <= 2) near += 1
    }
  }
  return near / Math.max(1, found)
}

/**
 * A sweep matches about 150 takes against the three songs. It takes a
 * second or two on an idle machine, and outran vitest's 5 s default on a
 * busy one (the full suite, 1 Nov 2026).
 */
const SWEEP_BUDGET_MS = 30_000

describe('where a take is placed in its song', () => {
  it(
    'places a take sung in the record’s octave as well as the pitches can',
    { timeout: SWEEP_BUDGET_MS },
    () => {
      // 69 % here. Placed by whichever of pitch, chroma or interval scored
      // best, in-octave takes fell to about 58 %: chroma fits in many places.
      expect(placedWithin2s(0)).toBeGreaterThanOrEqual(0.65)
    },
  )

  it(
    'places a take an octave away as well as one in the octave',
    { timeout: SWEEP_BUDGET_MS },
    () => {
      // 73 % either way here. Read off the absolute pitches alone, about 3 %.
      expect(placedWithin2s(12)).toBeGreaterThanOrEqual(0.65)
      expect(placedWithin2s(-12)).toBeGreaterThanOrEqual(0.65)
    },
  )

  it(
    'places some takes sung in another key, by their intervals',
    { timeout: SWEEP_BUDGET_MS },
    () => {
      // 51 % here. Read off the absolute pitches alone, about 14 %.
      expect(placedWithin2s(3)).toBeGreaterThanOrEqual(0.4)
    },
  )
})
