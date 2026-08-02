// ── Jam song tests ────────────────────────────────────────────────────
// A song runs on its own timeline in SECONDS, separate from the beat grid
// the drills use. These pin the line lookup the lyrics column depends on,
// the flight compensation that keeps peers together, and the refusal that
// stops a room loading a song half of it cannot fetch.

import { describe, expect, it } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import { lineAt, lineIndexAt, secondsInFlight, songPlayableInRoom, } from '@/lib/jam/jam-song'
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

  it('refuses a device-local song, and says why', () => {
    // Loading it would leave everyone else in silence with no explanation.
    const verdict = songPlayableInRoom(song({ origin: 'local' }))
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/only on your device/i)
  })

  it('refuses a song with no backing track', () => {
    const verdict = songPlayableInRoom(song({ stems: { instrumental: '' } }))
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/backing track/i)
  })
})
