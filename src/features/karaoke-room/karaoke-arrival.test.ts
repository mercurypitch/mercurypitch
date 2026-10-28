// ============================================================
// The Karaoke room's arrival: which song goes on the stage, and how
// ============================================================

import { describe, expect, it } from 'vitest'
import { arrivalCue, arrivalSong } from './karaoke-arrival'
import type { RoomSong } from './karaoke-room-library'
import type { ParkedSong } from './karaoke-room-store'

const song = (sessionId: string): RoomSong => ({
  sessionId,
  title: sessionId,
  artist: null,
  durationSec: 200,
  credit: null,
  kind: 'yours',
  stems: { vocal: '', instrumental: '' },
})

const ROWS = [song('mine'), song('karaoke-night-demo'), song('other')]

const parkedAt = (sessionId: string, seconds: number): ParkedSong => ({
  sessionId,
  seconds,
  guide: { volume: 0.4, muted: false },
})

describe("the room's arrival", () => {
  it('cues a parked song first, then the staged, the last sung, the demo, the first', () => {
    expect(
      arrivalSong(ROWS, parkedAt('other', 31), 'mine', null)?.sessionId,
    ).toBe('other')
    expect(arrivalSong(ROWS, null, 'mine', 'other')?.sessionId).toBe('mine')
    expect(arrivalSong(ROWS, null, null, 'other')?.sessionId).toBe('other')
    expect(arrivalSong(ROWS, null, null, null)?.sessionId).toBe(
      'karaoke-night-demo',
    )
    expect(arrivalSong([song('only')], null, null, null)?.sessionId).toBe(
      'only',
    )
    expect(arrivalSong([], null, null, null)).toBeNull()
  })

  it('brings a parked song back where it stopped, paused, with its guide', () => {
    expect(arrivalCue(ROWS, parkedAt('other', 31), null, null, null)).toEqual({
      song: ROWS[2],
      resuming: true,
      autoPlay: false,
      seekSec: 31,
      guide: { volume: 0.4, muted: false },
    })
  })

  it("plays First note's song from where the singer came in, before a parked one", () => {
    expect(
      arrivalCue(ROWS, parkedAt('other', 31), 'mine', null, {
        sessionId: 'mine',
        seekSec: 12.5,
      }),
    ).toEqual({
      song: ROWS[0],
      resuming: false,
      autoPlay: true,
      seekSec: 12.5,
      guide: null,
    })
  })

  it('answers a studio hand-back, without a place, as the staged song, paused', () => {
    expect(
      arrivalCue(ROWS, null, 'mine', null, { sessionId: 'mine' }),
    ).toMatchObject({ song: ROWS[0], autoPlay: false, seekSec: undefined })
  })

  it('arrives as it would have when the song handed over is not in the library', () => {
    expect(
      arrivalCue(ROWS, null, 'gone', 'other', {
        sessionId: 'gone',
        seekSec: 9,
      }),
    ).toMatchObject({ song: ROWS[2], autoPlay: false, seekSec: undefined })
  })
})
