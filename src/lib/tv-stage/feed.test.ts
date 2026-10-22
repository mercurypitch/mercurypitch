// ============================================================
// TV stage feed tests — the room's state, as the stage gets it
// ============================================================

import { describe, expect, it } from 'vitest'
import { FRAME_READINGS_LIMIT, midiOfFrequency, singerSince, tvStageFrame, tvStageScore, tvStageSong, } from '@/lib/tv-stage/feed'
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
