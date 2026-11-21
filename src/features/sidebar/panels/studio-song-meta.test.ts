// Studio song metadata tests — duration, lane count and last edit as the sidebar writes them.
import { describe, expect, it } from 'vitest'
import { songDuration, songEdited, songLanes } from './studio-song-meta'

const RATE = 48_000

describe('songDuration', () => {
  it('writes minutes and seconds, flooring part seconds', () => {
    expect(songDuration(RATE * 222)).toBe('3:42')
    expect(songDuration(RATE * 5.9)).toBe('0:05')
    expect(songDuration(RATE * 600)).toBe('10:00')
  })

  it('adds hours from an hour on', () => {
    expect(songDuration(RATE * 3_600)).toBe('1:00:00')
    expect(songDuration(RATE * (3_600 * 2 + 65))).toBe('2:01:05')
  })

  it('reads an empty or broken length as no time', () => {
    expect(songDuration(0)).toBe('0:00')
    expect(songDuration(-RATE)).toBe('0:00')
    expect(songDuration(Number.NaN)).toBe('0:00')
  })
})

describe('songLanes', () => {
  it('counts lanes in Studio words', () => {
    expect(songLanes(1)).toBe('1 lane')
    expect(songLanes(4)).toBe('4 lanes')
    expect(songLanes(0)).toBe('No lanes')
  })
})

describe('songEdited', () => {
  const now = new Date('2026-11-20T15:00:00')

  it('names today and yesterday by the day, not the date', () => {
    expect(songEdited('2026-11-20T08:00:00', now, 'en-US')).toEqual({
      short: 'Today',
      long: 'Edited today',
    })
    expect(songEdited('2026-11-19T23:59:00', now, 'en-US')).toEqual({
      short: 'Yesterday',
      long: 'Edited yesterday',
    })
  })

  it('writes an older day as its date, with the year once it is another year', () => {
    expect(songEdited('2026-11-12T10:00:00', now, 'en-US')).toEqual({
      short: 'Nov 12',
      long: 'Edited Nov 12',
    })
    expect(songEdited('2025-12-30T10:00:00', now, 'en-US')).toEqual({
      short: 'Dec 30, 2025',
      long: 'Edited Dec 30, 2025',
    })
  })

  it('says nothing for a date it cannot read', () => {
    expect(songEdited('not a date', now, 'en-US')).toBeNull()
  })
})
