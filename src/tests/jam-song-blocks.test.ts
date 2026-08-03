// Blocks are what a person actually reads: "Ada takes the second verse",
// not "line 7 belongs to Ada". The lanes derive note ownership from the
// same blocks, so the words and the pitch can never disagree.

import { describe, expect, it } from 'vitest'
import { blockOfLine, groupLinesBySinger, isComingUp, noteSingers, singerAt, } from '@/lib/jam/jam-song-blocks'
import type { JamSongNote, LyricsLineTiming } from '@/lib/jam/types'

const lines: LyricsLineTiming[] = [
  { text: 'one', startSec: 0, endSec: 2 },
  { text: 'two', startSec: 2, endSec: 4 },
  { text: 'three', startSec: 4, endSec: 6 },
  { text: 'four', startSec: 6, endSec: 8 },
]

describe('groupLinesBySinger', () => {
  it('merges a run of lines with the same singer', () => {
    const blocks = groupLinesBySinger(lines, { 0: 'ada', 1: 'ada', 2: 'bo' })
    expect(blocks).toEqual([
      { singerId: 'ada', fromLine: 0, toLine: 1, startSec: 0, endSec: 4 },
      { singerId: 'bo', fromLine: 2, toLine: 2, startSec: 4, endSec: 6 },
      { singerId: null, fromLine: 3, toLine: 3, startSec: 6, endSec: 8 },
    ])
  })

  it('returns unassigned runs as blocks too, so callers walk one list', () => {
    const blocks = groupLinesBySinger(lines, {})
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ singerId: null, fromLine: 0, toLine: 3 })
  })

  it('does not merge the same singer across somebody else', () => {
    // Ada, Bo, Ada is three blocks -- merging the Adas would put Bo's line
    // inside Ada's block.
    const blocks = groupLinesBySinger(lines, { 0: 'ada', 1: 'bo', 2: 'ada' })
    expect(blocks.map((b) => b.singerId)).toEqual(['ada', 'bo', 'ada', null])
  })

  it('is empty for a song with no words', () => {
    expect(groupLinesBySinger([], { 0: 'ada' })).toEqual([])
  })
})

describe('blockOfLine', () => {
  it('finds the block a line sits inside', () => {
    const blocks = groupLinesBySinger(lines, { 0: 'ada', 1: 'ada' })
    expect(blockOfLine(blocks, 1)?.singerId).toBe('ada')
    expect(blockOfLine(blocks, 1)?.fromLine).toBe(0)
  })

  it('is null for a line that is not there', () => {
    expect(blockOfLine(groupLinesBySinger(lines, {}), 99)).toBeNull()
  })
})

describe('noteSingers', () => {
  const notes: JamSongNote[] = [
    { midi: 60, startSec: 0.5, endSec: 1.5 },
    { midi: 62, startSec: 4.5, endSec: 5.5 },
    { midi: 64, startSec: 20, endSec: 21 },
  ]

  it('gives each note the singer of the line it starts under', () => {
    const blocks = groupLinesBySinger(lines, { 0: 'ada', 1: 'ada', 2: 'bo' })
    expect(noteSingers(notes, blocks)).toEqual(['ada', 'bo', null])
  })

  it('assigns by the note’s start, not its overlap', () => {
    // A note beginning under Ada's last line and ringing into Bo's first
    // is Ada's: she is the one who has to sing it.
    const blocks = groupLinesBySinger(lines, { 1: 'ada', 2: 'bo' })
    const ringing: JamSongNote[] = [{ midi: 60, startSec: 3.9, endSec: 4.6 }]
    expect(noteSingers(ringing, blocks)).toEqual(['ada'])
  })

  it('leaves notes outside the lyrics to the room', () => {
    // An intro riff belongs to nobody in particular, so to everybody.
    const blocks = groupLinesBySinger(lines, { 0: 'ada' })
    expect(
      noteSingers([{ midi: 60, startSec: 99, endSec: 100 }], blocks),
    ).toEqual([null])
  })
})

describe('isComingUp', () => {
  const blocks = groupLinesBySinger(lines, { 2: 'ada' })

  it('warns a singer shortly before their block starts', () => {
    // Ada's block starts at 4; at 1.5 she is 2.5 s away.
    expect(isComingUp(blocks, 'ada', 1.5)).toBe(true)
  })

  it('stays quiet while their entry is still far off', () => {
    expect(isComingUp(blocks, 'ada', 0, 2)).toBe(false)
  })

  it('stays quiet once they are already singing', () => {
    // Lit through the part they are in the middle of would be noise.
    expect(isComingUp(blocks, 'ada', 4.5)).toBe(false)
  })

  it('never warns the room, only a named singer', () => {
    // Everyone's lines are nobody's cue; that is just the lyrics.
    expect(isComingUp(blocks, null, 1.5)).toBe(false)
  })
})

describe('singerAt', () => {
  const blocks = groupLinesBySinger(lines, { 0: 'ada', 2: 'bo' })

  it('reports who is singing right now', () => {
    expect(singerAt(blocks, 0.5)).toBe('ada')
    expect(singerAt(blocks, 4.5)).toBe('bo')
  })

  it('is null in an unassigned stretch or off the end', () => {
    expect(singerAt(blocks, 2.5)).toBeNull()
    expect(singerAt(blocks, 99)).toBeNull()
  })
})
