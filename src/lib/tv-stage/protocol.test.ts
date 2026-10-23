// ============================================================
// TV stage protocol tests — what a stage takes, and what it drops
// ============================================================

import { describe, expect, it } from 'vitest'
import type { TvStageFrame, TvStageSong } from '@/lib/tv-stage/protocol'
import { readTvStageMessage, TV_STAGE_IDLE, TV_STAGE_PROTOCOL, } from '@/lib/tv-stage/protocol'

const SONG: TvStageSong = {
  v: TV_STAGE_PROTOCOL,
  kind: 'song',
  title: 'Goodbye to Spring',
  duration: 184.5,
  notes: [{ t0: 1.2, t1: 1.8, midi: 64 }],
  lyrics: [
    { at: 0, current: [], next: 'The first line', words: [] },
    {
      at: 1.1,
      current: ['The', 'first', 'line'],
      next: null,
      words: [
        [1.1, 1.3],
        [1.3, 1.6],
        [1.6, 2],
      ],
    },
  ],
}

const FRAME: TvStageFrame = {
  v: TV_STAGE_PROTOCOL,
  kind: 'frame',
  at: 1_790_000_000_000,
  position: 12.25,
  playing: true,
  rate: 1,
  singer: [
    [12.1, 64.2],
    [12.15, 64.4],
  ],
  score: { pct: 87, grade: 'A' },
}

describe('reading a message', () => {
  it.each([
    ['a song', SONG],
    ['a frame', FRAME],
    ['a frame before anything was judged', { ...FRAME, score: null }],
    ['idle', TV_STAGE_IDLE],
  ])('takes %s as it was sent', (_name, message) => {
    expect(readTvStageMessage(JSON.stringify(message))).toEqual(message)
  })

  it('drops what is not JSON', () => {
    expect(readTvStageMessage('{"v":1,"kind":')).toBeNull()
  })

  it('drops another version of the protocol', () => {
    expect(readTvStageMessage(JSON.stringify({ ...FRAME, v: 2 }))).toBeNull()
  })

  it('drops a kind it does not know', () => {
    expect(
      readTvStageMessage(JSON.stringify({ v: 1, kind: 'karaoke' })),
    ).toBeNull()
  })

  it.each([
    ['a note without its end', { ...SONG, notes: [{ t0: 1, midi: 60 }] }],
    [
      'a lyric line with a number for a word',
      { ...SONG, lyrics: [{ at: 0, current: [3], next: null, words: [] }] },
    ],
    ['a title that is not text', { ...SONG, title: 7 }],
  ])('drops a song with %s', (_name, message) => {
    expect(readTvStageMessage(JSON.stringify(message))).toBeNull()
  })

  it.each([
    ['a position that is not a number', { ...FRAME, position: '12' }],
    ['a reading that is not a pair', { ...FRAME, singer: [[12.1]] }],
    ['a score without its grade', { ...FRAME, score: { pct: 80 } }],
  ])('drops a frame with %s', (_name, message) => {
    expect(readTvStageMessage(JSON.stringify(message))).toBeNull()
  })
})
