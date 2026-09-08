import { describe, expect, it, vi } from 'vitest'
import { matchVoiceCommand } from '@/features/voice-control/command-grammar'
import type { GuitarNightVoiceDeps, GuitarNightVoiceTrack, } from './guitar-night-voice-commands'
import { createGuitarNightVoiceCommands } from './guitar-night-voice-commands'

interface Fixture {
  deps: GuitarNightVoiceDeps
  calls: string[]
  seekedTo: () => number | null
  track: (id: string) => GuitarNightVoiceTrack
}

function makeFixture(): Fixture {
  const calls: string[] = []
  let playing = false
  let rate = 1
  let seekedTo: number | null = null
  const tracks: GuitarNightVoiceTrack[] = [
    { id: 'vocal', muted: true, available: true },
    { id: 'drums', muted: false, available: true },
    { id: 'guitar', muted: false, available: true },
    { id: 'piano', muted: false, available: false },
  ]
  const find = (id: string): GuitarNightVoiceTrack => {
    const track = tracks.find((t) => t.id === id)
    if (track === undefined) throw new Error(`no fixture track ${id}`)
    return track
  }

  const deps: GuitarNightVoiceDeps = {
    playing: () => playing,
    positionSeconds: () => 30,
    durationSeconds: () => 200,
    play: () => {
      calls.push('play')
      playing = true
    },
    pause: () => {
      calls.push('pause')
      playing = false
    },
    stop: () => {
      calls.push('stop')
      playing = false
    },
    seek: (seconds) => {
      seekedTo = seconds
      calls.push('seek')
    },
    playbackRate: () => rate,
    setPlaybackRate: (next) => {
      calls.push(`rate:${String(next)}`)
      rate = next
    },
    tracks: () => tracks,
    setTrackMuted: (id, muted) => {
      calls.push(`mute:${id}:${String(muted)}`)
      find(id).muted = muted
    },
  }

  return { deps, calls, seekedTo: () => seekedTo, track: find }
}

/** Runs one utterance; returns the success label or the failure message. */
function fire(fixture: Fixture, utterance: string): string | undefined {
  const commands = createGuitarNightVoiceCommands(fixture.deps)
  const match = matchVoiceCommand(utterance, commands)
  if (match === null) return undefined
  const result = match.command.run({ n: match.n, m: match.m })
  if (typeof result === 'string') return result
  if (typeof result === 'object') return result.message
  return match.command.label
}

describe('guitar night voice commands', () => {
  it.each(['forward', 'skip forward', 'back', 'skip back'])(
    'supports the bare %s command with a ten-second step',
    (phrase) => {
      const fixture = makeFixture()
      expect(fire(fixture, phrase)).toBe(
        phrase.includes('forward') ? 'Forward 10s' : 'Back 10s',
      )
      expect(fixture.seekedTo()).toBe(phrase.includes('forward') ? 40 : 20)
    },
  )

  it('does not claim playback or seek succeeded without an available melody', () => {
    const fixture = makeFixture()
    fixture.deps.playbackIssue = () => 'Record or open a melody first.'
    for (const phrase of ['play', 'pause', 'from the top', 'forward', 'rewind'])
      expect(fire(fixture, phrase)).toBe('Record or open a melody first.')
    expect(fixture.calls).toEqual([])
  })

  it('clamps spoken seeks to the loaded source without starting playback', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'forward five minutes')).toBe('Forward 300s')
    expect(fixture.seekedTo()).toBe(200)
    expect(fire(fixture, 'back ten minutes')).toBe('Back 600s')
    expect(fixture.seekedTo()).toBe(0)
    expect(fixture.calls).toEqual(['seek', 'seek'])
  })

  it('does not turn a repeated Play into a pending-play cancellation', () => {
    const fixture = makeFixture()
    fixture.deps.pending = () => true
    expect(fire(fixture, 'play')).toBe('Playback is starting')
    expect(fire(fixture, 'pause')).toBe('Pause')
    expect(fixture.calls).toEqual(['pause'])
  })

  it('omits unsupported audition speed and stem commands', () => {
    const fixture = makeFixture()
    fixture.deps.speedAvailable = () => false
    fixture.deps.stemsAvailable = () => false
    expect(fire(fixture, 'half speed')).toBeUndefined()
    expect(fire(fixture, 'mute drums')).toBeUndefined()
    expect(fixture.calls).toEqual([])
  })

  it.each([
    'record',
    'record melody',
    'record a melody',
    'record idea',
    'record an idea',
    'record my idea',
    'start recording',
    'start a recording',
    'record a take',
  ])(
    'starts capture explicitly for "%s", without toggling or playing',
    (phrase) => {
      const fixture = makeFixture()
      let state: 'idle' | 'preparing' = 'idle'
      const start = vi.fn(async () => {
        state = 'preparing'
      })
      fixture.deps.recorder = {
        state: () => state,
        start,
        stop: vi.fn(async () => undefined),
        startIssue: () => null,
      }
      expect(fire(fixture, phrase)).toBe('Starting recording')
      expect(fire(fixture, phrase)).toBe('Recording is preparing')
      expect(start).toHaveBeenCalledTimes(1)
      expect(fixture.calls).toEqual([])
    },
  )

  it.each(['preparing', 'recording', 'stopping'] as const)(
    'protects %s capture while leaving Stop reachable',
    (state) => {
      const fixture = makeFixture()
      const stop = vi.fn(async () => undefined)
      fixture.deps.recorder = {
        state: () => state,
        start: vi.fn(async () => undefined),
        stop,
        startIssue: () => null,
      }
      for (const phrase of [
        'play',
        'pause',
        'forward 15',
        'from the top',
        'half speed',
      ])
        expect(fire(fixture, phrase)).toMatch(/recording/i)
      expect(fixture.calls).toEqual([])
      expect(fire(fixture, 'stop')).toBe(
        state === 'preparing'
          ? 'Cancelling recording start'
          : state === 'recording'
            ? 'Finishing recording'
            : 'Recording is saving',
      )
      expect(stop).toHaveBeenCalledTimes(state === 'stopping' ? 0 : 1)
      expect(fixture.calls).toEqual([])
    },
  )

  it('reports an unsupported recording input without opening it or touching replay', () => {
    const fixture = makeFixture()
    const start = vi.fn(async () => undefined)
    fixture.deps.recorder = {
      state: () => 'idle',
      start,
      stop: vi.fn(async () => undefined),
      startIssue: () =>
        'Choose Direct input or Room mic to record audio and notes.',
    }
    expect(fire(fixture, 'record')).toMatch(/Choose Direct input/)
    expect(fire(fixture, 'stop recording')).toBe('No recording is running')
    expect(start).not.toHaveBeenCalled()
    expect(fixture.calls).toEqual([])
  })

  it('drives the room transport in seconds', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'play')).toBe('Play')
    expect(fire(fixture, 'play')).toBe('Already playing')
    expect(fire(fixture, 'backwards 20')).toBe('Back 20s')
    expect(fixture.seekedTo()).toBe(10)
    expect(fire(fixture, 'from the top')).toBe('From the top')
    expect(fixture.seekedTo()).toBe(0)
    expect(fire(fixture, 'pause')).toBe('Pause')
  })

  it('mutes and unmutes stems by kind, respecting availability', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'mute the drums')).toBe('Drums muted')
    expect(fixture.track('drums').muted).toBe(true)
    expect(fire(fixture, 'unmute vocals')).toBe('Vocal on')
    expect(fixture.track('vocal').muted).toBe(false)
    // Present but unavailable stems answer like missing ones.
    expect(fire(fixture, 'mute keys')).toBe('No piano stem in this session')
    expect(fire(fixture, 'mute bass')).toBe('No bass stem in this session')
  })

  it('controls the playback rate with the shared speed rules', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'faster')).toBe('Speed 1.5x')
    expect(fixture.deps.playbackRate()).toBe(1.5)
    expect(fire(fixture, 'half speed')).toBe('Speed 0.5x')
    expect(fire(fixture, '10 x')).toBe('Speed 2x')
    expect(fire(fixture, 'speed 75 percent')).toBe('Speed 0.75x')
  })
})
