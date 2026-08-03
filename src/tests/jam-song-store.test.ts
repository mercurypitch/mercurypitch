// ── Song room tests ───────────────────────────────────────────────────
// A room runs a song OR a drill, never both, and a song moves in seconds
// while a drill moves in beats. These pin the exclusivity and the refusal,
// because getting either wrong produces a room that looks fine and is
// subtly desynced.

import { createComputed, createRoot } from 'solid-js'
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

  it('disarms the brush when a different song loads', () => {
    // A brush still armed from the last sheet would turn the first click
    // on the new words into a paint instead of a seek.
    store.toggleJamAssignBrush('ada')
    expect(store.jamAssignBrush()).toBe('ada')
    store.selectJamSong(song({ id: 'other' }))
    expect(store.jamAssignBrush()).toBeNull()
  })

  it('disarms the brush when the song is cleared', () => {
    store.toggleJamAssignBrush('ada')
    store.clearJamSong()
    expect(store.jamAssignBrush()).toBeNull()
  })

  it('only lets the host hold a brush', () => {
    store.setJamIsHost(false)
    store.toggleJamAssignBrush('ada')
    expect(store.jamAssignBrush()).toBeNull()
  })

  it('picking the armed singer again puts the brush down', () => {
    store.toggleJamAssignBrush('ada')
    store.toggleJamAssignBrush('ada')
    expect(store.jamAssignBrush()).toBeNull()
  })

  it('resets the host clock target with the song', () => {
    // Otherwise a guest carries the last song's correction into the new
    // one and gets yanked there on the first transport message.
    store.selectJamSong(song({ id: 'a' }))
    expect(store.jamSongHostTarget()).toBe(0)
    store.clearJamSong()
    expect(store.jamSongHostTarget()).toBe(0)
  })

  it('forgets the allocation when a different song loads', () => {
    // A new song is a new lyric sheet; line 3 means something else now.
    store.assignJamSongLines(0, 2, 'ada')
    store.selectJamSong(song({ id: 'other' }))
    expect(store.jamSongParts()).toEqual({})
  })
})

// Rules R1-R6 in docs/plans/jam-room-transport-rules.md. These exist
// because the room has two playback engines and one pair of signals: get
// this wrong and somebody's five-second scale stops the song, which is
// exactly what happened.
describe('transport is scoped, and the host drives it', () => {
  beforeEach(() => {
    store.clearJamSong()
    store.setJamError(null)
    store.setJamPeers([])
    store.setJamIsHost(true)
    store.setJamPeerId('me')
  })

  it('R10: a send in flight blocks a second send and a song swap', () => {
    store.selectJamSong(song())
    store.setJamShareState({ phase: 'sending', ratio: 0.4, message: 'x' })
    expect(store.jamSendInFlight()).toBe(true)
    // The song must not change under a transfer that is describing it.
    expect(store.selectJamSong(song({ id: 'other' }))).toBe(false)
    expect(store.jamSong()?.id).toBe('demo')
    store.setJamShareState({ phase: 'idle', ratio: 0, message: '' })
    expect(store.jamSendInFlight()).toBe(false)
    expect(store.selectJamSong(song({ id: 'other' }))).toBe(true)
  })

  it('a peer announcing a melody does not stop the host song', () => {
    // The second root cause, and it hid behind a different message type:
    // a guest broadcast its own melody, and onMelodyMessage set the very
    // signal the song's audio reads. The only trace was 'recv melody'.
    store.selectJamSong(song())
    store.jamSongPlay(0)
    expect(store.jamExercisePlaying()).toBe(true)
    store.applyRemoteMelody({
      type: 'melody',
      action: 'set',
      melody: melody(),
    })
    expect(store.jamExercisePlaying()).toBe(true)
    expect(store.jamSong()).not.toBeNull()
  })

  it('a guest running a song ignores a melody too', () => {
    store.selectJamSong(song())
    store.jamSongPlay(0)
    store.setJamIsHost(false)
    store.applyRemoteMelody({
      type: 'melody',
      action: 'set',
      melody: melody(),
    })
    expect(store.jamExercisePlaying()).toBe(true)
    expect(store.jamExerciseMelody()).toBeNull()
  })

  it('a drill ending does not stop a song', () => {
    // The reported bug: a peer's five-second scale finishing broadcast a
    // bare stop, every peer applied it to whatever it was running, and the
    // room's song died seconds after it started.
    store.selectJamSong(song())
    store.jamSongPlay(0)
    expect(store.jamExercisePlaying()).toBe(true)
    store.setJamIsHost(false)
    store.applyRemoteTransport({
      type: 'playback',
      action: 'stop',
      scope: 'drill',
      currentBeat: 0,
      timestamp: 0,
    })
    expect(store.jamExercisePlaying()).toBe(true)
  })

  it('a song command does not disturb a drill', () => {
    store.clearJamSong()
    store.setJamIsHost(false)
    store.setJamExercisePlaying(true)
    store.applyRemoteTransport({
      type: 'playback',
      action: 'stop',
      scope: 'song',
      positionSec: 0,
      timestamp: 0,
    })
    expect(store.jamExercisePlaying()).toBe(true)
  })

  it('a command with no scope is treated as a drill, for older clients', () => {
    store.clearJamSong()
    store.setJamIsHost(false)
    store.setJamExercisePlaying(true)
    store.applyRemoteTransport({
      type: 'playback',
      action: 'stop',
      currentBeat: 0,
      timestamp: 0,
    })
    expect(store.jamExercisePlaying()).toBe(false)
  })

  it('R7: the drill transport is inert while the room is on a song', () => {
    // The third root cause of "the song stopped and nobody touched it".
    // A song room had a drill in it -- the panel's auto-select put one
    // back the moment loading a song cleared it -- so the host had a
    // second play button wired to the same playing signal, and its beat
    // timer ended and stopped the song.
    store.selectJamSong(song())
    store.jamSongPlay(0)
    expect(store.jamExercisePlaying()).toBe(true)

    store.jamPlaybackStop()
    expect(store.jamExercisePlaying()).toBe(true)

    store.jamSongPause(12)
    store.jamPlaybackPlay()
    expect(store.jamExerciseBeat()).toBe(0)
    expect(store.jamSongPositionSec()).toBe(12)
  })

  it('R7: nothing ever sees a room that is neither a drill nor a song', () => {
    // How the drill kept coming back. Outside a batch every setter flushes
    // its observers, so clearing the melody ran the panel's "pick a
    // default melody if none is loaded" effect at a moment when the song
    // had not been set yet: it saw an empty drill room and helpfully put a
    // drill back. The room then had both, the drill owned the transport,
    // and its beat timer stopped the song.
    store.selectJamExercise(melody())
    const halfLoaded: boolean[] = []
    createRoot((dispose) => {
      // createComputed, not createEffect: it runs synchronously on every
      // write, which is exactly the observer the panel's effect was.
      createComputed(() => {
        halfLoaded.push(
          store.jamSong() === null && store.jamExerciseMelody() === null,
        )
      })
      store.selectJamSong(song())
      dispose()
    })
    expect(halfLoaded.slice(1)).not.toContain(true)
    expect(store.jamExerciseMelody()).toBeNull()
    expect(store.jamSong()?.id).toBe('demo')
  })

  it('R7: picking a drill switches the room off the song', () => {
    store.selectJamSong(song())
    store.jamSongPlay(0)
    store.selectJamExercise(melody())
    expect(store.jamSong()).toBeNull()
    expect(store.jamExerciseMelody()?.id).toBe('jam-exercise-long-note')
    expect(store.jamIsSongRoom()).toBe(false)
  })

  it('the audio arriving does not start playing by itself', () => {
    // What a tester saw: the guest began playing on its own while the
    // host sat stopped. `playing` is this device's record of what the
    // HOST is doing and it can be stale -- a stop issued under the drill
    // scope is ignored here -- so clearing `paused` when the file landed
    // was enough to start a song nobody had pressed play on.
    store.selectJamSong(song({ origin: 'local' }))
    store.setJamIsHost(false)
    store.setJamExercisePlaying(true)
    store.setJamExercisePaused(true)
    store.applyReceivedStem('instrumental', new Blob(['x']))
    expect(store.jamExercisePlaying()).toBe(false)
    expect(store.jamExercisePaused()).toBe(false)
  })

  it('asks the element to rewind on stop, not just the readout', () => {
    // The element IS the clock: its timeupdate writes the position, so
    // setting the position alone is overwritten on the next tick. Going
    // through a seek request is also what lets the transport controls live
    // outside the component that owns the element.
    store.selectJamSong(song())
    const before = store.jamSongSeekRequest().token
    store.jamSongSeek(42)
    expect(store.jamSongSeekRequest()).toEqual({
      toSec: 42,
      token: before + 1,
    })
    store.jamSongStop()
    expect(store.jamSongSeekRequest()).toEqual({ toSec: 0, token: before + 2 })
  })

  it('a guest told to stop rewinds too', () => {
    store.selectJamSong(song())
    store.setJamIsHost(false)
    const before = store.jamSongSeekRequest().token
    store.applyRemoteTransport({
      type: 'playback',
      action: 'stop',
      scope: 'song',
      positionSec: 0,
      timestamp: 0,
    })
    expect(store.jamSongSeekRequest().token).toBe(before + 1)
    expect(store.jamExercisePlaying()).toBe(false)
  })

  it('the host ignores transport it is sent', () => {
    // It is the driver; obeying somebody else would make the room fight.
    store.selectJamSong(song())
    store.jamSongPlay(0)
    store.applyRemoteTransport({
      type: 'playback',
      action: 'stop',
      scope: 'song',
      positionSec: 0,
      timestamp: 0,
    })
    expect(store.jamExercisePlaying()).toBe(true)
  })
})

describe('who can actually hear the song', () => {
  beforeEach(() => {
    store.clearJamSong()
    store.setJamError(null)
    store.setJamPeers([])
    store.setJamIsHost(true)
    store.setJamPeerId('me')
  })

  it('counts an ordinary fetchable song as playable', () => {
    expect(
      store.songIsPlayableHere(
        song({ stems: { instrumental: 'https://example.test/i.m4a' } }),
      ),
    ).toBe(true)
  })

  it('refuses somebody else’s blob URL', () => {
    // The bug this pins: onSongMessage stamps every incoming manifest
    // 'url', so judging by origin made a guest holding the host's own blob
    // URL report "I can hear it" -- and the host's re-send prompt vanished
    // for the one person who needed it. A blob URL belongs to the document
    // that made it.
    expect(
      store.songIsPlayableHere(
        song({ stems: { instrumental: 'blob:https://x/1' } }),
      ),
    ).toBe(false)
  })

  it('counts our OWN separation as playable', () => {
    // The host made that blob URL, so suppressing their genuine audio
    // errors because it "looks like somebody else's" would hide real
    // faults from the one person who can fix them.
    expect(
      store.songIsPlayableHere(
        song({
          origin: 'local',
          stems: { instrumental: 'blob:https://x/mine' },
        }),
      ),
    ).toBe(true)
  })

  it('refuses a song with no backing track at all', () => {
    expect(
      store.songIsPlayableHere(song({ stems: { instrumental: '' } })),
    ).toBe(false)
    expect(store.songIsPlayableHere(null)).toBe(false)
  })

  it('lists connected peers who have not said they can hear it', () => {
    store.selectJamSong(song())
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
    expect(store.jamPeersMissingSong().map((p) => p.id)).toEqual(['ada'])
    store.setJamSongHaves({ ada: true })
    expect(store.jamPeersMissingSong()).toEqual([])
  })

  it('forgets who had it when a different song loads', () => {
    store.selectJamSong(song())
    store.setJamSongHaves({ ada: true })
    store.selectJamSong(song({ id: 'other' }))
    expect(store.jamSongHaves()).toEqual({})
  })

  it('nobody is missing a song that is not loaded', () => {
    store.clearJamSong()
    expect(store.jamPeersMissingSong()).toEqual([])
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
