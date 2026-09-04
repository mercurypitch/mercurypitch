// The rules, on a room list that is not the chambers.
// ============================================================
//
// chamber-track.test.ts keeps testing the chambers' instance in full;
// this checks that the generic module is honestly generic -- a second
// world with its own key must neither see nor touch the first's walk.

import { beforeEach, describe, expect, it } from 'vitest'
import { createTrack, EMPTY_TRACK } from './track'

const ROOMS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as const

const entries = new Map<string, string>()
beforeEach(() => {
  entries.clear()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
    },
  })
})

describe('a track over any rooms', () => {
  const track = createTrack(ROOMS, 'test:track-one')

  it('walks in order and opens the next room on a finish', () => {
    expect(track.currentRoom(EMPTY_TRACK).id).toBe('a')
    const after = track.recordClear(EMPTY_TRACK, 'a', 0)
    expect(track.isOpen(after, 'b')).toBe(true)
    expect(track.isOpen(after, 'c')).toBe(false)
    expect(track.progressLabel(after)).toBe('1 of 3')
    expect(track.roomAfter('c')).toBeNull()
  })

  it('keeps the best and stays finished on the last room', () => {
    let s = EMPTY_TRACK
    for (const r of ROOMS) s = track.recordClear(s, r.id, 40)
    s = track.recordClear(s, 'b', 90)
    s = track.recordClear(s, 'b', 10)
    expect(s.best.b).toBe(90)
    expect(track.isFinished(s)).toBe(true)
    expect(track.currentRoom(s).id).toBe('c')
    expect(track.walkGrade(s)).toBe(Math.round((40 + 90 + 40) / 3))
  })

  it("remembers under its own key and nobody else's", () => {
    const other = createTrack([{ id: 'x' }], 'test:track-two')
    track.writeTrack(track.recordClear(EMPTY_TRACK, 'a', 50))
    expect(track.readTrack().cleared).toEqual(['a'])
    expect(other.readTrack()).toEqual(EMPTY_TRACK)
    other.writeTrack(other.recordClear(EMPTY_TRACK, 'x', 70))
    expect(track.readTrack().cleared).toEqual(['a'])
  })

  it('drops rooms that are not on this track any more', () => {
    entries.set(
      'test:track-one',
      JSON.stringify({ cleared: ['a', 'gone'], best: { a: 30, gone: 99 } }),
    )
    expect(track.readTrack()).toEqual({ cleared: ['a'], best: { a: 30 } })
  })
})
