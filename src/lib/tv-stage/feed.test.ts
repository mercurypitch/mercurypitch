// ============================================================
// TV stage feed tests — the room's state, as the stage gets it
// ============================================================
//
// The second half puts a NaN or an infinity where each number comes from,
// and reads the message as the stage would after it crossed as JSON: it
// must arrive whole, with the bad number dropped or made safe.

import { describe, expect, it } from 'vitest'
import type { LyricWindowSegment } from '@/lib/lyric-window-script'
import type { FeedNote, FeedReading } from '@/lib/tv-stage/feed'
import { FRAME_READINGS_LIMIT, midiOfFrequency, singerSince, tvStageFrame, tvStageScore, tvStageSong, } from '@/lib/tv-stage/feed'
import type { TvStageFrame, TvStageMessage, TvStageReading, TvStageScore, } from '@/lib/tv-stage/protocol'
import { readTvStageMessage } from '@/lib/tv-stage/protocol'

describe('the song', () => {
  it('carries the notes as the lane draws them, and drops one with no length', () => {
    const song = tvStageSong({
      title: 'Goodbye to Spring',
      duration: 184.4567,
      notes: [
        { midi: 64, startSec: 1.23456, endSec: 1.98765 },
        { midi: 65, startSec: 3, endSec: 3 },
      ],
      lyrics: [{ at: 0, current: [], next: 'A line', words: [] }],
    })

    expect(song.notes).toEqual([{ t0: 1.235, t1: 1.988, midi: 64 }])
    expect(song.lyrics).toEqual([
      { at: 0, current: [], next: 'A line', words: [] },
    ])
    expect(readTvStageMessage(JSON.stringify(song))).toEqual(song)
  })
})

describe('the lane’s notes', () => {
  it('carries each at its own pitch, as the phone’s lane has it: none rounded, folded or moved', () => {
    const lane = [
      { midi: 40, startSec: 1, endSec: 1.5 },
      { midi: 64.37, startSec: 2, endSec: 2.5 },
      { midi: 88, startSec: 3, endSec: 4 },
    ]

    const song = tvStageSong({
      title: 'River Road',
      duration: 10,
      notes: lane,
      lyrics: [],
    })

    expect(song.notes).toEqual([
      { t0: 1, t1: 1.5, midi: 40 },
      { t0: 2, t1: 2.5, midi: 64.37 },
      { t0: 3, t1: 4, midi: 88 },
    ])
  })
})

describe('the singer’s readings', () => {
  const history = [
    { time: 10, frequency: 440 },
    { time: 10.05, frequency: 0 },
    { time: 10.1, frequency: 880 },
    { time: 10.15, frequency: 466.16 },
  ]

  it('sends those after the last one sent, oldest first, as MIDI', () => {
    expect(singerSince(history, 10, 0)).toEqual([
      [10.1, 81],
      [10.15, 70],
    ])
  })

  it('moves each back by the round trip the calibration measured', () => {
    expect(singerSince(history, 9.85, 0.2)).toEqual([
      [9.9, 81],
      [9.95, 70],
    ])
  })

  it('caps a frame at its limit, keeping the newest', () => {
    const many = Array.from({ length: FRAME_READINGS_LIMIT + 5 }, (_, i) => ({
      time: i / 100,
      frequency: 440,
    }))

    const sent = singerSince(many, -1, 0)

    expect(sent).toHaveLength(FRAME_READINGS_LIMIT)
    expect(sent.at(-1)?.[0]).toBe((FRAME_READINGS_LIMIT + 4) / 100)
  })

  it('reads A4 as MIDI 69', () => {
    expect(midiOfFrequency(440)).toBe(69)
  })
})

describe('the score and the frame', () => {
  it('shows no score before anything was judged', () => {
    expect(
      tvStageScore({ totalNotes: 0, accuracyPct: 0, grade: 'D' }),
    ).toBeNull()
    expect(tvStageScore(null)).toBeNull()
    expect(
      tvStageScore({ totalNotes: 40, accuracyPct: 86.6, grade: 'A' }),
    ).toEqual({ pct: 87, grade: 'A' })
  })

  it('makes a frame the stage reads as it was meant', () => {
    const frame = tvStageFrame({
      at: 1_790_000_000_000.4,
      position: 12.34567,
      playing: true,
      rate: 0,
      singer: [[12.3, 64.2]],
      score: { pct: 87, grade: 'A' },
    })

    expect(frame.position).toBe(12.346)
    expect(frame.rate).toBe(1)
    expect(frame.at).toBe(1_790_000_000_000)
    expect(readTvStageMessage(JSON.stringify(frame))).toEqual(frame)
  })

  it('never sends a position before the song’s start', () => {
    const frame = tvStageFrame({
      at: 0,
      position: -0.3,
      playing: false,
      rate: 1,
      singer: [],
      score: null,
    })

    expect(frame.position).toBe(0)
  })
})

/** NaN and both infinities: what JSON writes as null. */
const BAD = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

/** Each case of `fields` with each bad number, for `it.each`. */
const withBad = <T>(fields: readonly T[]): [T, number][] =>
  fields.flatMap((field) => BAD.map((bad): [T, number] => [field, bad]))

/** The message as the stage reads it, once it has crossed as JSON. */
const crossed = (message: TvStageMessage): TvStageMessage | null =>
  readTvStageMessage(JSON.stringify(message))

describe('a song with a number that is not one', () => {
  const NOTE: FeedNote = { midi: 64, startSec: 1, endSec: 2 }
  const NEXT_NOTE: FeedNote = { midi: 65, startSec: 3, endSec: 4 }
  const LINE: LyricWindowSegment = {
    at: 1,
    current: ['The', 'first', 'line'],
    next: null,
    words: [
      [1.1, 1.3],
      [1.3, 1.6],
      [1.6, 2],
    ],
  }
  const NEXT_LINE: LyricWindowSegment = { ...LINE, at: 2.5 }
  const song = (over: Partial<Parameters<typeof tvStageSong>[0]>) =>
    tvStageSong({
      title: 'Goodbye to Spring',
      duration: 184,
      notes: [NOTE, NEXT_NOTE],
      lyrics: [LINE, NEXT_LINE],
      ...over,
    })

  it.each(BAD)('sends a length of %s as not known yet', (bad) => {
    const message = song({ duration: bad })

    expect(crossed(message)).toEqual(message)
    expect(message.duration).toBe(0)
  })

  it.each(withBad(['startSec', 'endSec', 'midi'] as const))(
    'drops a note whose %s is %s, and keeps the rest',
    (field, bad) => {
      const message = song({ notes: [{ ...NOTE, [field]: bad }, NEXT_NOTE] })

      expect(crossed(message)).toEqual(message)
      expect(message.notes).toEqual([{ t0: 3, t1: 4, midi: 65 }])
    },
  )

  it.each(BAD)('drops a lyric line that starts at %s', (bad) => {
    const message = song({ lyrics: [{ ...LINE, at: bad }, NEXT_LINE] })

    expect(crossed(message)).toEqual(message)
    expect(message.lyrics).toEqual([NEXT_LINE])
  })

  it.each(BAD)(
    'lights a line’s words up to a timing of %s, and leaves the rest unlit',
    (bad) => {
      const words: LyricWindowSegment['words'] = [
        [1.1, 1.3],
        [1.3, bad],
        [1.6, 2],
      ]
      const message = song({ lyrics: [{ ...LINE, words }] })

      expect(crossed(message)).toEqual(message)
      expect(message.lyrics).toEqual([{ ...LINE, words: [[1.1, 1.3]] }])
    },
  )
})

describe('a frame with a number that is not one', () => {
  const CLOCK = {
    at: 1_790_000_000_000,
    position: 12.5,
    playing: true,
    rate: 1,
  }
  const READING: TvStageReading = [12.4, 64]
  const SCORE = { pct: 81, grade: 'B' }
  const before = tvStageFrame({ ...CLOCK, singer: [], score: null })
  const frame = (
    over: Partial<Parameters<typeof tvStageFrame>[0]>,
    previous: TvStageFrame | null = before,
  ) =>
    tvStageFrame(
      {
        ...CLOCK,
        at: CLOCK.at + 50,
        position: 12.55,
        singer: [READING],
        score: SCORE,
        ...over,
      },
      previous,
    )

  it.each(withBad(['position', 'at'] as const))(
    'carries the last good clock again when its %s is %s, with its readings and score',
    (field, bad) => {
      const sent = frame({ [field]: bad, playing: false, rate: 0.5 })

      expect(crossed(sent)).toEqual(sent)
      expect(sent).toMatchObject({
        at: CLOCK.at,
        position: 12.5,
        playing: true,
        rate: 1,
        singer: [READING],
        score: SCORE,
      })
    },
  )

  it.each(BAD)(
    'says the song’s start, standing still, for a position of %s before any good clock',
    (bad) => {
      const sent = frame({ position: bad }, null)

      expect(crossed(sent)).toEqual(sent)
      expect(sent).toMatchObject({ at: 0, position: 0, playing: false })
    },
  )

  it.each(BAD)('plays as written at a rate of %s', (bad) => {
    const sent = frame({ rate: bad })

    expect(crossed(sent)).toEqual(sent)
    expect(sent.rate).toBe(1)
  })

  it.each(withBad([0, 1] as const))(
    'drops a reading with %s as %s, and keeps the rest',
    (index, bad) => {
      const broken: [number, number] = [12.3, 63]
      broken[index] = bad
      const sent = frame({ singer: [broken, READING] })

      expect(crossed(sent)).toEqual(sent)
      expect(sent.singer).toEqual([READING])
    },
  )

  it.each(BAD)('sends no score for a share of %s', (bad) => {
    const sent = frame({ score: { pct: bad, grade: 'B' } })

    expect(crossed(sent)).toEqual(sent)
    expect(sent.score).toBeNull()
  })
})

describe('the microphone with a number that is not one', () => {
  const GOOD: FeedReading = { time: 10.1, frequency: 880 }
  const frameOf = (
    singer: readonly TvStageReading[],
    score: TvStageScore | null = null,
  ) =>
    tvStageFrame({ at: 0, position: 10, playing: true, rate: 1, singer, score })

  it.each(withBad(['time', 'frequency'] as const))(
    'drops a reading whose %s is %s, and keeps the rest',
    (field, bad) => {
      const singer = singerSince([{ ...GOOD, [field]: bad }, GOOD], 0, 0)

      expect(singer).toEqual([[10.1, 81]])
      expect(crossed(frameOf(singer))).toEqual(frameOf(singer))
    },
  )

  it.each(BAD)('places no reading with a round trip of %s', (bad) => {
    expect(singerSince([GOOD], 0, bad)).toEqual([])
  })

  it.each(BAD)('shows no score for a share in tune of %s', (bad) => {
    const score = tvStageScore({ totalNotes: 10, accuracyPct: bad, grade: 'B' })

    expect(score).toBeNull()
    expect(crossed(frameOf([], score))).toEqual(frameOf([], score))
  })
})
