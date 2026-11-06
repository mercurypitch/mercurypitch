// ============================================================
// Cast demo song tests — a song the stage takes, small enough to send
// ============================================================

import { describe, expect, it } from 'vitest'
import { CAST_MESSAGE_LIMIT_BYTES } from '@/lib/cast-receiver/cast-config'
import { DEMO_SECONDS, DEMO_TITLE, demoFrame, demoSong, } from '@/lib/cast-receiver/demo-song'
import { castMessageBytes } from '@/lib/cast-receiver/receiver'
import { readTvStageValue } from '@/lib/tv-stage/protocol'

describe('the demo song', () => {
  it('is a song the stage takes, as a phone would send it', () => {
    const song = demoSong()
    expect(readTvStageValue(song)).toEqual(song)
    expect(song.title).toBe(DEMO_TITLE)
    expect(song.duration).toBe(DEMO_SECONDS)
    expect(song.notes.length).toBeGreaterThan(20)
  })

  it('times every word of every line, and every word has its note', () => {
    const song = demoSong()
    const sung = song.lyrics.filter((segment) => segment.current.length > 0)
    expect(sung).toHaveLength(6)
    for (const segment of sung)
      expect(segment.words).toHaveLength(segment.current.length)
    const words = sung.reduce((sum, segment) => sum + segment.current.length, 0)
    expect(song.notes).toHaveLength(words)
    for (const note of song.notes) {
      expect(note.t1).toBeGreaterThan(note.t0)
      expect(note.t1).toBeLessThanOrEqual(DEMO_SECONDS)
    }
  })

  // REQ-TV-111: a phone must be able to send it in one Cast message.
  it('fits in one Cast message', () => {
    expect(castMessageBytes(demoSong())).toBeLessThan(CAST_MESSAGE_LIMIT_BYTES)
  })
})

describe('the demo frames', () => {
  it('are frames the stage takes, read at the moment given', () => {
    const frame = demoFrame(3.2, 3.15, 1_700_000_000_000)
    expect(readTvStageValue(frame)).toEqual(frame)
    expect(frame).toMatchObject({
      at: 1_700_000_000_000,
      position: 3.2,
      playing: true,
      rate: 1,
    })
  })

  it('carry the singer since the last frame, close to the note being sung', () => {
    // The first word sounds from 2 s, at MIDI 60.
    const frame = demoFrame(2.3, 2.1, 0)
    expect(frame.singer.map(([time]) => time)).toEqual([2.15, 2.2, 2.25, 2.3])
    for (const [, midi] of frame.singer)
      expect(Math.abs(midi - 60)).toBeLessThan(0.5)
  })

  it('carry no singer in a rest', () => {
    expect(demoFrame(1, 0.9, 0).singer).toEqual([])
  })

  it('start the song again from the top after its length', () => {
    const frame = demoFrame(DEMO_SECONDS + 2.3, DEMO_SECONDS + 2.25, 0)
    expect(frame.position).toBeCloseTo(2.3, 3)
    expect(frame.singer).toHaveLength(1)
    // The frame across the wrap carries nobody rather than a jump.
    expect(
      demoFrame(DEMO_SECONDS + 0.05, DEMO_SECONDS - 0.05, 0).singer,
    ).toEqual([])
  })
})
