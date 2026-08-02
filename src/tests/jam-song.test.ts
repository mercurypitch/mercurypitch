// ── Jam song tests ────────────────────────────────────────────────────
// A song runs on its own timeline in SECONDS, separate from the beat grid
// the drills use. These pin the line lookup the lyrics column depends on,
// the flight compensation that keeps peers together, and the refusal that
// stops a room loading a song half of it cannot fetch.

import { describe, expect, it } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import { lineAt, lineIndexAt, restAt, restsBetween, secondsInFlight, songPlayableInRoom, } from '@/lib/jam/jam-song'
import type { LyricsLineTiming } from '@/lib/jam/types'

const lines: LyricsLineTiming[] = [
  { text: 'first', startSec: 0 },
  { text: 'second', startSec: 5 },
  { text: 'third', startSec: 10, endSec: 12 },
]

function song(over: Partial<JamSong> = {}): JamSong {
  return {
    id: 's1',
    title: 'Test',
    stems: { instrumental: 'https://example.test/inst.mp4' },
    lines,
    durationSec: 200,
    origin: 'url',
    ...over,
  }
}

describe('lineAt', () => {
  it('finds the line being sung', () => {
    expect(lineAt(lines, 0)?.text).toBe('first')
    expect(lineAt(lines, 4.9)?.text).toBe('first')
    expect(lineAt(lines, 5)?.text).toBe('second')
    expect(lineAt(lines, 10.5)?.text).toBe('third')
  })

  it('runs a line until the next one starts when it has no end', () => {
    // Most LRC lines carry only a start; the next line is the end.
    expect(lineAt(lines, 9.99)?.text).toBe('second')
  })

  it('respects an explicit end, so a gap shows nothing', () => {
    expect(lineAt(lines, 11.9)?.text).toBe('third')
    expect(lineAt(lines, 12)).toBeNull()
    expect(lineAt(lines, 50)).toBeNull()
  })

  it('is null before the first line', () => {
    expect(lineAt([{ text: 'late', startSec: 3 }], 1)).toBeNull()
  })

  it('survives a song with no lyrics at all', () => {
    // An instrumental is a legal song; the lyrics column is just empty.
    expect(lineAt([], 10)).toBeNull()
    expect(lineIndexAt([], 10)).toBe(-1)
  })

  it('reports the index for the scroller', () => {
    expect(lineIndexAt(lines, 5)).toBe(1)
    expect(lineIndexAt(lines, 50)).toBe(-1)
  })
})

describe('secondsInFlight', () => {
  it('charges half the round trip', () => {
    // A play at 0 arrives one-way-latency later; a peer starting at the
    // number in the message is permanently that far behind.
    expect(secondsInFlight(100)).toBeCloseTo(0.05)
  })

  it('ignores a missing or nonsense reading', () => {
    expect(secondsInFlight(0)).toBe(0)
    expect(secondsInFlight(-5)).toBe(0)
    expect(secondsInFlight(Number.NaN)).toBe(0)
  })

  it('clamps a stale reading rather than jumping the playhead', () => {
    // Half of the 500ms cap, not half of a wild number.
    expect(secondsInFlight(60_000)).toBeCloseTo(0.25)
  })
})

describe('songPlayableInRoom', () => {
  it('accepts a song every peer can fetch', () => {
    expect(songPlayableInRoom(song()).ok).toBe(true)
  })

  it('lets you sing your own song when you are alone', () => {
    // Practising alone with your own material is the obvious thing to
    // want; blocking it to protect a case that is not happening is just
    // unhelpful.
    const verdict = songPlayableInRoom(song({ origin: 'local' }), 0)
    expect(verdict.ok).toBe(true)
    expect(verdict.warning).toMatch(/only you can hear/i)
  })

  it('refuses a device-local song once somebody else is listening', () => {
    const verdict = songPlayableInRoom(song({ origin: 'local' }), 1)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/nobody else in the room could hear/i)
  })

  it('warns about a local song rather than staying silent about it', () => {
    // Silence with no explanation is the failure Relay's empty parts
    // taught us to avoid.
    expect(songPlayableInRoom(song({ origin: 'local' })).warning).toBeTruthy()
    expect(songPlayableInRoom(song()).warning).toBeUndefined()
  })

  it('refuses a song with no backing track', () => {
    const verdict = songPlayableInRoom(song({ stems: { instrumental: '' } }))
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/backing track/i)
  })
})

describe('rests', () => {
  const sung: LyricsLineTiming[] = [
    { text: 'one', startSec: 0, endSec: 4 },
    // Eight seconds of nothing -- a singer needs to know when to come back.
    { text: 'two', startSec: 12, endSec: 14 },
    // A short breath, not a rest.
    { text: 'three', startSec: 15, endSec: 17 },
  ]

  it('finds the gap worth counting into', () => {
    const rests = restsBetween(sung)
    expect(rests).toHaveLength(1)
    expect(rests[0]).toMatchObject({ beforeLine: 1, startSec: 4, endSec: 12 })
  })

  it('ignores a breath between lines', () => {
    // 1s from 14 to 15 is a phrase break, not a rest.
    expect(restsBetween(sung).some((r) => r.beforeLine === 2)).toBe(false)
  })

  it('caps the dots, because a long intro is not forty dots', () => {
    const long = [
      { text: 'a', startSec: 0, endSec: 1 },
      { text: 'b', startSec: 60 },
    ]
    expect(restsBetween(long)[0]!.dotCount).toBeLessThanOrEqual(8)
  })

  it('does not treat the time before the first line as a rest', () => {
    // That is an intro and wants a count-in of its own.
    const late = [{ text: 'first', startSec: 20, endSec: 22 }]
    expect(restsBetween(late)).toEqual([])
  })

  it('uses the next line start when a line has no end', () => {
    const open = [
      { text: 'a', startSec: 0 },
      { text: 'b', startSec: 10 },
    ]
    expect(restsBetween(open)).toEqual([])
  })

  it('counts down rather than reporting the total', () => {
    // "two left" is the useful number, not "this rest is eight seconds".
    const rests = restsBetween(sung)
    expect(restAt(rests, 10)?.secondsLeft).toBeCloseTo(2)
    expect(restAt(rests, 5)?.secondsLeft).toBeCloseTo(7)
  })

  it('is null while someone is actually singing', () => {
    expect(restAt(restsBetween(sung), 1)).toBeNull()
    expect(restAt(restsBetween(sung), 13)).toBeNull()
  })
})
