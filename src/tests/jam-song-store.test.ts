// ── Song room tests ───────────────────────────────────────────────────
// A room runs a song OR a drill, never both, and a song moves in seconds
// while a drill moves in beats. These pin the exclusivity and the refusal,
// because getting either wrong produces a room that looks fine and is
// subtly desynced.

import { beforeEach, describe, expect, it } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import * as store from '@/stores/jam-store'
import type { MelodyData, NoteName } from '@/types'

function song(over: Partial<JamSong> = {}): JamSong {
  return {
    id: 'demo',
    title: 'Demo',
    stems: { instrumental: 'https://example.test/inst.m4a' },
    lines: [{ text: 'a line', startSec: 0 }],
    durationSec: 180,
    origin: 'url',
    ...over,
  }
}

function melody(): MelodyData {
  return {
    id: 'jam-exercise-long-note',
    name: 'Long Note',
    bpm: 80,
    key: 'C',
    scaleType: 'major',
    createdAt: 0,
    updatedAt: 0,
    items: [
      {
        id: 1,
        note: { midi: 60, name: 'C' as NoteName, octave: 4, freq: 261.63 },
        duration: 8,
        startBeat: 0,
      },
    ],
  }
}

describe('a room running a song', () => {
  beforeEach(() => {
    store.clearJamSong()
    store.setJamError(null)
  })

  it('loads a song every peer can fetch', () => {
    expect(store.selectJamSong(song())).toBe(true)
    expect(store.jamSong()?.id).toBe('demo')
    expect(store.jamIsSongRoom()).toBe(true)
  })

  it('lets you sing your own song when the room is just you', () => {
    store.setJamPeers([])
    expect(store.selectJamSong(song({ origin: 'local' }))).toBe(true)
    expect(store.jamSong()?.origin).toBe('local')
  })

  it('refuses your own song once somebody else is listening', () => {
    // The problem was never the song, it was somebody expecting to hear
    // it. This is the check that has to read the ROOM, not just the song
    // -- passing no peer count meant it could never fire.
    store.setJamPeers([
      {
        id: 'p1',
        displayName: 'Ada',
        connectionState: 'connected',
        latency: 0,
        hasVideo: false,
        hasAudio: true,
      },
    ])
    expect(store.selectJamSong(song({ origin: 'local' }))).toBe(false)
    expect(store.jamSong()).toBeNull()
    expect(store.jamError()).toMatch(/nobody else in the room could hear/i)
    store.setJamPeers([])
  })

  it('clears the drill when a song loads', () => {
    // One thing at a time: a beat playhead running under a song is a
    // second clock nobody is watching.
    store.selectJamExercise(melody())
    expect(store.jamExerciseMelody()).not.toBeNull()
    store.selectJamSong(song())
    expect(store.jamExerciseMelody()).toBeNull()
    expect(store.jamExercisePlaying()).toBe(false)
  })

  it('starts at the top and tracks position in seconds', () => {
    store.selectJamSong(song())
    store.jamSongPlay(0)
    expect(store.jamSongPositionSec()).toBe(0)
    store.jamSongSeek(42.5)
    expect(store.jamSongPositionSec()).toBeCloseTo(42.5)
  })

  it('rewinds on stop, and holds position on pause', () => {
    store.selectJamSong(song())
    store.jamSongPlay(0)
    store.jamSongPause(30)
    expect(store.jamSongPositionSec()).toBe(30)
    expect(store.jamExercisePaused()).toBe(true)
    store.jamSongStop()
    expect(store.jamSongPositionSec()).toBe(0)
    expect(store.jamExercisePlaying()).toBe(false)
  })

  it('will not play a room with no song loaded', () => {
    store.jamSongPlay(10)
    expect(store.jamExercisePlaying()).toBe(false)
    expect(store.jamSongPositionSec()).toBe(0)
  })

  it('leaves the room on a drill until a song is chosen', () => {
    expect(store.jamIsSongRoom()).toBe(false)
  })
})
