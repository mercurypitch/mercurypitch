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
    notes: [],
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

  it('loads your own song with peers present, and asks you to send it', () => {
    // Once the transfer existed this stopped being a refusal: the room
    // can fix it, so it offers the button instead. The check still has to
    // read the ROOM rather than just the song -- that is what decides
    // whether there is anybody to send to at all.
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
    expect(store.selectJamSong(song({ origin: 'local' }))).toBe(true)
    expect(store.jamSong()?.origin).toBe('local')
    expect(store.jamError()).toBeNull()
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

describe('per-line scores', () => {
  const scored = (lineIndex: number, score: number, noteCount = 2) => ({
    lineIndex,
    startSec: 0,
    endSec: 1,
    score,
    voiced: true,
    noteCount,
  })

  beforeEach(() => {
    store.clearJamSong()
    store.setJamError(null)
    store.setJamPeers([])
  })

  it('keeps the latest attempt at a line, not both', () => {
    // Scrubbing back to retake a line should replace the score, otherwise
    // the run average is dragged down by an attempt you deliberately redid.
    store.recordJamLineScore(scored(3, 40))
    store.recordJamLineScore(scored(3, 95))
    expect(store.jamSongLineScores()[3]?.score).toBe(95)
    expect(Object.keys(store.jamSongLineScores())).toHaveLength(1)
  })

  it('does not record a line that had nothing to sing', () => {
    // An empty badge on an instrumental bar reads as a zero you earned.
    store.recordJamLineScore(scored(0, 0, 0))
    expect(store.jamSongLineScores()[0]).toBeUndefined()
    expect(store.jamSongRunScore()).toBeNull()
  })

  it('averages the run across scored lines', () => {
    store.recordJamLineScore(scored(0, 100))
    store.recordJamLineScore(scored(1, 50))
    expect(store.jamSongRunScore()?.score).toBe(75)
    expect(store.jamSongRunScore()?.totalLines).toBe(2)
  })

  it('starts a fresh take when a new song loads', () => {
    store.recordJamLineScore(scored(0, 100))
    store.selectJamSong(song())
    expect(store.jamSongRunScore()).toBeNull()
  })

  it('clears on a play from the top but survives a resume', () => {
    store.selectJamSong(song())
    store.recordJamLineScore(scored(0, 100))
    // Resuming after a breath must not cost you the lines you sang.
    store.jamSongPlay(42)
    expect(store.jamSongRunScore()?.score).toBe(100)
    store.jamSongPlay(0)
    expect(store.jamSongRunScore()).toBeNull()
  })
})

describe('who sings which line', () => {
  beforeEach(() => {
    store.clearJamSong()
    store.setJamError(null)
    store.setJamPeers([])
    store.setJamIsHost(true)
    store.setJamPeerId('me')
    store.selectJamSong(song())
  })

  it('gives every line to the room until somebody assigns one', () => {
    expect(store.jamLineIsMine(0)).toBe(true)
    expect(store.jamSongParts()).toEqual({})
  })

  it('assigns a run of lines in one go', () => {
    store.assignJamSongLines(1, 3, 'ada')
    expect(store.jamSongParts()).toEqual({ 1: 'ada', 2: 'ada', 3: 'ada' })
  })

  it('knows which lines are mine once parts exist', () => {
    store.assignJamSongLines(0, 0, 'me')
    store.assignJamSongLines(1, 1, 'ada')
    expect(store.jamLineIsMine(0)).toBe(true)
    expect(store.jamLineIsMine(1)).toBe(false)
    // Still unassigned, so still everyone's.
    expect(store.jamLineIsMine(2)).toBe(true)
  })

  it('refuses to let a guest re-cut the song', () => {
    // The allocation is authored by the host; two people editing it from
    // opposite ends of a mesh is a room nobody can sing in.
    store.setJamIsHost(false)
    store.assignJamSongLines(0, 2, 'ada')
    expect(store.jamSongParts()).toEqual({})
  })

  it('hands a departed singer’s lines on rather than letting them go silent', () => {
    store.setJamPeers([
      {
        id: 'ada',
        displayName: 'Ada',
        connectionState: 'connected',
        latency: 0,
        hasVideo: false,
        hasAudio: true,
      },
    ])
    store.assignJamSongLines(0, 0, 'ada')
    store.assignJamSongLines(1, 1, 'bo')
    // Bo was never in the peer list, so bo's line is orphaned.
    store.rehomeJamSongParts()
    expect(store.jamSongParts()[1]).not.toBe('bo')
    expect(store.jamSongParts()[1]).toBeDefined()
  })

  it('forgets the allocation when a different song loads', () => {
    // A new song is a new lyric sheet; line 3 means something else now.
    store.assignJamSongLines(0, 2, 'ada')
    store.selectJamSong(song({ id: 'other' }))
    expect(store.jamSongParts()).toEqual({})
  })
})

describe('attaching lyrics to a loaded song', () => {
  beforeEach(() => {
    store.clearJamSong()
    store.setJamError(null)
    store.setJamPeers([])
    // Explicit rather than inherited: the parts suite above leaves the
    // room hosted, and a test that only passes in file order is a trap.
    store.setJamIsHost(false)
    store.setJamPeerId(null)
  })

  it('gives the loaded song its words', () => {
    store.selectJamSong(song({ lines: [] }))
    store.attachJamSongLyrics([{ text: 'found', startSec: 1 }])
    expect(store.jamSong()?.lines).toEqual([{ text: 'found', startSec: 1 }])
  })

  it('drops scores earned against the old words', () => {
    // Line 0 meant something different before the lyrics arrived.
    store.selectJamSong(song({ lines: [] }))
    store.recordJamLineScore({
      lineIndex: 0,
      startSec: 0,
      endSec: 1,
      score: 90,
      voiced: true,
      noteCount: 2,
    })
    store.attachJamSongLyrics([{ text: 'found', startSec: 1 }])
    expect(store.jamSongRunScore()).toBeNull()
  })

  it('ignores an empty result rather than blanking the column', () => {
    store.selectJamSong(song())
    const before = store.jamSong()?.lines
    store.attachJamSongLyrics([])
    expect(store.jamSong()?.lines).toEqual(before)
  })

  it('does nothing when no song is loaded', () => {
    store.attachJamSongLyrics([{ text: 'x', startSec: 0 }])
    expect(store.jamSong()).toBeNull()
  })
})
