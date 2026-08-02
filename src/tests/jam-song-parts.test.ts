import { describe, expect, it } from 'vitest'
import { assignLine, assignRange, EVERYONE, isMyLine, nextLineFor, rehomeDeparted, singerOfLine, singersInSong, } from '@/lib/jam/jam-song-parts'
import type { LyricsLineTiming } from '@/lib/jam/types'

describe('singerOfLine', () => {
  it('reads back an assignment', () => {
    expect(singerOfLine({ 2: 'ada' }, 2)).toBe('ada')
  })

  it('treats an unassigned line as the room’s', () => {
    expect(singerOfLine({}, 0)).toBeNull()
    expect(singerOfLine({ 0: EVERYONE }, 0)).toBeNull()
  })
})

describe('isMyLine', () => {
  it('gives unassigned lines to everyone, which is the default song', () => {
    // A song nobody has divided up is a unison singalong -- the feature
    // costs nothing until it is used.
    expect(isMyLine({}, 0, 'ada')).toBe(true)
    expect(isMyLine({}, 0, null)).toBe(true)
  })

  it('is mine when I am the named singer', () => {
    expect(isMyLine({ 1: 'ada' }, 1, 'ada')).toBe(true)
  })

  it('is not mine when somebody else has it', () => {
    expect(isMyLine({ 1: 'bo' }, 1, 'ada')).toBe(false)
    // No identity yet: an assigned line cannot be mine.
    expect(isMyLine({ 1: 'bo' }, 1, null)).toBe(false)
  })
})

describe('assignLine', () => {
  it('assigns without touching the other lines', () => {
    const parts = assignLine({ 0: 'ada' }, 1, 'bo')
    expect(parts).toEqual({ 0: 'ada', 1: 'bo' })
  })

  it('hands a line back to the room rather than storing a blank singer', () => {
    // Storing '' would make singersInSong and rehoming reason about a
    // peer id that is not one.
    expect(assignLine({ 0: 'ada' }, 0, EVERYONE)).toEqual({})
  })

  it('does not mutate what it was given', () => {
    const before = { 0: 'ada' }
    assignLine(before, 1, 'bo')
    expect(before).toEqual({ 0: 'ada' })
  })
})

describe('assignRange', () => {
  it('assigns a whole verse in one gesture', () => {
    expect(assignRange({}, 2, 4, 'ada')).toEqual({
      2: 'ada',
      3: 'ada',
      4: 'ada',
    })
  })

  it('accepts a range dragged backwards', () => {
    expect(assignRange({}, 4, 2, 'ada')).toEqual({
      2: 'ada',
      3: 'ada',
      4: 'ada',
    })
  })

  it('clears a range back to the room', () => {
    expect(assignRange({ 0: 'a', 1: 'a', 2: 'b' }, 0, 1, EVERYONE)).toEqual({
      2: 'b',
    })
  })
})

describe('rehomeDeparted', () => {
  it('hands a departed singer’s lines to whoever is still here', () => {
    // The rule is that a part never falls silent: from inside the room,
    // silence is indistinguishable from the song being broken.
    const parts = { 0: 'ada', 1: 'bo' }
    expect(rehomeDeparted(parts, ['ada', 'host'])).toEqual({
      0: 'ada',
      1: 'ada',
    })
  })

  it('returns the lines to the room when nobody is left to take them', () => {
    expect(rehomeDeparted({ 0: 'ada' }, [])).toEqual({})
  })

  it('leaves an untouched map identical, so nothing is re-broadcast', () => {
    const parts = { 0: 'ada' }
    // Same reference: the caller uses this to decide whether to send.
    expect(rehomeDeparted(parts, ['ada'])).toBe(parts)
  })
})

describe('singersInSong', () => {
  it('lists singers in the order their first line appears', () => {
    expect(singersInSong({ 5: 'bo', 1: 'ada', 9: 'bo' })).toEqual(['ada', 'bo'])
  })

  it('ignores lines that belong to the room', () => {
    expect(singersInSong({ 0: EVERYONE })).toEqual([])
  })
})

describe('nextLineFor', () => {
  const lines: LyricsLineTiming[] = [
    { text: 'one', startSec: 0 },
    { text: 'two', startSec: 10 },
    { text: 'three', startSec: 20 },
  ]

  it('finds my next assigned line, so a backing singer gets a warning', () => {
    const out = nextLineFor(lines, { 2: 'ada' }, 'ada', 5)
    expect(out).toEqual({ lineIndex: 2, startSec: 20 })
  })

  it('skips lines that belong to the room', () => {
    // Cueing every unassigned line would just be reading out the lyrics.
    expect(nextLineFor(lines, {}, 'ada', 0)).toBeNull()
  })

  it('skips somebody else’s lines', () => {
    expect(nextLineFor(lines, { 1: 'bo' }, 'ada', 0)).toBeNull()
  })

  it('is null once my last line has passed', () => {
    expect(nextLineFor(lines, { 1: 'ada' }, 'ada', 15)).toBeNull()
  })
})
